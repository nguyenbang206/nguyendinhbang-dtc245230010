const express = require('express');
const mysql = require('mysql2/promise');
const client = require('prom-client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 32) { console.error('JWT_SECRET phai >= 32 ky tu'); process.exit(1); }

const app = express();
app.set('trust proxy', 1);                       // dang sau Nginx
app.use(express.json({ limit: '50kb' }));
app.use(express.static('public'));

/* ---------- Metrics + log ---------- */
client.collectDefaultMetrics();
const dur = new client.Histogram({
  name: 'http_request_duration_seconds', help: 'HTTP latency',
  labelNames: ['method', 'route', 'status'], buckets: [.01, .05, .1, .5, 1, 2]
});
app.use((req, res, next) => {
  const end = dur.startTimer();
  res.on('finish', () => end({ method: req.method, route: req.route?.path || req.path, status: res.statusCode }));
  console.log(`${req.method} ${req.originalUrl}`);   // khong log body (co mat khau)
  next();
});

const pool = mysql.createPool({
  host: process.env.DB_HOST, user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, database: process.env.DB_NAME, connectionLimit: 10
});
const db = async (sql, p) => (await pool.query(sql, p))[0];
const bad = (status, msg) => Object.assign(new Error(msg), { status });

/* ---------- Xac thuc + phan quyen ---------- */
const auth = async (req, res, next) => {
  let id;
  try {
    const c = (req.headers.cookie || '').split(/;\s*/).find(x => x.startsWith('token='));
    id = jwt.verify(c.slice(6), SECRET).id;
  } catch { throw bad(401, 'Chua dang nhap'); }
  const [u] = await db('SELECT id, username, full_name, role, student_id FROM users WHERE id=?', [id]);
  if (!u) throw bad(401, 'Tai khoan khong con ton tai');   // doc quyen moi tu DB moi request
  req.user = u; next();
};
const only = (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : next(bad(403, 'Khong du quyen'));

const fails = new Map();                           // chong do mat khau: 5 lan/10 phut
app.post('/api/login', async (req, res) => {
  const username = String(req.body.username || ''), password = String(req.body.password || '');
  const key = req.ip + '|' + username, f = fails.get(key) || { n: 0, t: 0 };
  if (Date.now() - f.t >= 600000) f.n = 0;
  if (f.n >= 5) throw bad(429, 'Sai qua nhieu lan, thu lai sau 10 phut');
  const [u] = await db('SELECT * FROM users WHERE username=?', [username]);
  if (!u || !(await bcrypt.compare(password, u.password_hash))) {
    fails.set(key, { n: f.n + 1, t: Date.now() });
    throw bad(401, 'Sai tai khoan hoac mat khau');
  }
  fails.delete(key);
  res.cookie('token', jwt.sign({ id: u.id }, SECRET, { expiresIn: '8h' }),
    { httpOnly: true, sameSite: 'strict', secure: req.secure, maxAge: 8 * 3600 * 1000 });
  res.json({ id: u.id, role: u.role, full_name: u.full_name, student_id: u.student_id });
});
app.post('/api/logout', (req, res) => { res.clearCookie('token'); res.json({ ok: 1 }); });
app.get('/api/me', auth, (req, res) => res.json(req.user));

/* ---------- Doc du lieu: moi vai tro chi thay phan cua minh ---------- */
// admin: tat ca | teacher: lop minh phu trach | student: chi ban than
const sw = u => ({
  admin: ['', []],
  teacher: [' WHERE c.teacher_id=?', [u.id]],
  student: [' WHERE s.id=?', [u.student_id]]
}[u.role]);

app.get('/api/classes', auth, async (req, res) => {
  const u = req.user, w = {
    admin: ['', []],
    teacher: [' WHERE c.teacher_id=?', [u.id]],
    student: [' WHERE c.id=(SELECT class_id FROM students WHERE id=?)', [u.student_id]]
  }[u.role];
  res.json(await db('SELECT c.*, t.full_name teacher_name, (SELECT COUNT(*) FROM students WHERE class_id=c.id) n ' +
    'FROM classes c LEFT JOIN users t ON t.id=c.teacher_id' + w[0], w[1]));
});
app.get('/api/students', auth, async (req, res) => {
  const [w, p] = sw(req.user);
  res.json(await db('SELECT s.*, c.name class_name FROM students s LEFT JOIN classes c ON c.id=s.class_id' + w, p));
});
const SC = 'SELECT sc.*, s.code, s.full_name, s.class_id, c.name class_name FROM scores sc ' +
  'JOIN students s ON s.id=sc.student_id LEFT JOIN classes c ON c.id=s.class_id';
app.get('/api/scores', auth, async (req, res) => {
  const [w, p] = sw(req.user);
  res.json(await db(SC + w, p));
});

/* ---------- Diem: admin + giao vien (chi sinh vien trong lop minh) ---------- */
const canGrade = async (u, sid) => u.role === 'admin' || (u.role === 'teacher' &&
  (await db('SELECT 1 FROM students s JOIN classes c ON c.id=s.class_id WHERE s.id=? AND c.teacher_id=?', [sid, u.id])).length > 0);
const parseScore = b => {
  const n = Number(b.score);
  if (b.score == null || b.score === '' || !(n >= 0 && n <= 10) || !b.subject || !Number.isInteger(+b.student_id))
    throw bad(400, 'Du lieu diem khong hop le');
  return [+b.student_id, String(b.subject).slice(0, 100), n];
};
const grader = [auth, only('admin', 'teacher')];
app.post('/api/scores', ...grader, async (req, res) => {
  const [sid, sub, n] = parseScore(req.body);
  if (!await canGrade(req.user, sid)) throw bad(403, 'Sinh vien khong thuoc lop cua ban');
  const r = await db('INSERT INTO scores (student_id, subject, score) VALUES (?,?,?)', [sid, sub, n]);
  res.status(201).json({ id: r.insertId });
});
app.put('/api/scores/:id', ...grader, async (req, res) => {
  const [sid, sub, n] = parseScore(req.body);
  const [old] = await db('SELECT student_id FROM scores WHERE id=?', [req.params.id]);
  if (!old) throw bad(404, 'Khong tim thay');
  if (!await canGrade(req.user, old.student_id) || !await canGrade(req.user, sid)) throw bad(403, 'Khong co quyen voi sinh vien nay');
  await db('UPDATE scores SET student_id=?, subject=?, score=? WHERE id=?', [sid, sub, n, req.params.id]);
  res.json({ ok: 1 });
});
app.delete('/api/scores/:id', ...grader, async (req, res) => {
  const [old] = await db('SELECT student_id FROM scores WHERE id=?', [req.params.id]);
  if (!old) throw bad(404, 'Khong tim thay');
  if (!await canGrade(req.user, old.student_id)) throw bad(403, 'Khong co quyen voi sinh vien nay');
  await db('DELETE FROM scores WHERE id=?', [req.params.id]);
  res.json({ ok: 1 });
});

/* ---------- Lop, sinh vien, tai khoan: chi admin ---------- */
function crud(path, table, fields) {
  const r = express.Router(); r.use(auth, only('admin'));
  const vals = b => fields.map(f => b[f] === '' || b[f] === undefined ? null : b[f]);
  r.post('/', async (req, res) => {
    const x = await db(`INSERT INTO ${table} (${fields}) VALUES (${fields.map(() => '?')})`, vals(req.body));
    res.status(201).json({ id: x.insertId });
  });
  r.put('/:id', async (req, res) => {
    await db(`UPDATE ${table} SET ${fields.map(f => f + '=?')} WHERE id=?`, [...vals(req.body), req.params.id]);
    res.json({ ok: 1 });
  });
  r.delete('/:id', async (req, res) => { await db(`DELETE FROM ${table} WHERE id=?`, [req.params.id]); res.json({ ok: 1 }); });
  app.use('/api/' + path, r);
}
crud('classes', 'classes', ['name', 'teacher_id']);
crud('students', 'students', ['code', 'full_name', 'email', 'class_id']);

const U = express.Router(); U.use(auth, only('admin'));
const checkUser = (b, needPw) => {
  if (!/^[\w.-]{3,50}$/.test(b.username || '') || !['admin', 'teacher', 'student'].includes(b.role)) throw bad(400, 'Tai khoan hoac vai tro khong hop le');
  if ((needPw || b.password) && String(b.password || '').length < 8) throw bad(400, 'Mat khau toi thieu 8 ky tu');
};
U.get('/', async (req, res) => res.json(await db('SELECT id, username, full_name, role, student_id FROM users')));
U.post('/', async (req, res) => {
  const b = req.body; checkUser(b, true);
  const x = await db('INSERT INTO users (username, password_hash, full_name, role, student_id) VALUES (?,?,?,?,?)',
    [b.username, await bcrypt.hash(b.password, 10), b.full_name || b.username, b.role, b.student_id || null]);
  res.status(201).json({ id: x.insertId });
});
U.put('/:id', async (req, res) => {
  const b = req.body; checkUser(b, false);
  let sql = 'UPDATE users SET username=?, full_name=?, role=?, student_id=?';
  const p = [b.username, b.full_name || b.username, b.role, b.student_id || null];
  if (b.password) { sql += ', password_hash=?'; p.push(await bcrypt.hash(b.password, 10)); }
  await db(sql + ' WHERE id=?', [...p, req.params.id]);
  res.json({ ok: 1 });
});
U.delete('/:id', async (req, res) => {
  if (+req.params.id === req.user.id) throw bad(400, 'Khong the xoa chinh minh');
  await db('DELETE FROM users WHERE id=?', [req.params.id]);
  res.json({ ok: 1 });
});
app.use('/api/users', U);

app.get('/metrics', async (q, s) => { s.set('Content-Type', client.register.contentType); s.end(await client.register.metrics()); });
app.use('/api', (q, s) => s.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  const st = err.status || (err.code === 'ER_DUP_ENTRY' ? 409 : 500);
  if (st === 500) console.error('ERROR', err.message);
  res.status(st).json({ error: st === 500 ? 'Loi may chu' : st === 409 ? 'Du lieu bi trung' : err.message });
});

/* ---------- Tao tai khoan mau lan dau (mat khau lay tu .env) ---------- */
async function seed() {
  const [{ n }] = await db('SELECT COUNT(*) n FROM users');
  if (n) return;
  const add = async (un, pw, name, role, sid) => (await db(
    'INSERT INTO users (username, password_hash, full_name, role, student_id) VALUES (?,?,?,?,?)',
    [un, await bcrypt.hash(pw, 10), name, role, sid])).insertId;
  await add('admin', process.env.ADMIN_PASSWORD, 'Quan tri vien', 'admin', null);
  const t1 = await add('gv01', process.env.TEACHER_PASSWORD, 'Nguyen Van A', 'teacher', null);
  const t2 = await add('gv02', process.env.TEACHER_PASSWORD, 'Le Thi C', 'teacher', null);
  await add('sv001', process.env.STUDENT_PASSWORD, 'Tran Thi B', 'student', 1);
  await add('sv003', process.env.STUDENT_PASSWORD, 'Le Minh E', 'student', 3);
  await db('UPDATE classes SET teacher_id=? WHERE id=1', [t1]);
  await db('UPDATE classes SET teacher_id=? WHERE id=2', [t2]);
  console.log('Da tao tai khoan mau: admin, gv01, gv02, sv001, sv003');
}
seed().then(() => app.listen(3000, () => console.log('App listening on 3000')))
  .catch(e => { console.error('Seed loi:', e.message); process.exit(1); });

