CREATE TABLE classes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  teacher_id INT NULL
);
CREATE TABLE students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100),
  class_id INT,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL
);
CREATE TABLE scores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  subject VARCHAR(100) NOT NULL,
  score DECIMAL(4,2) CHECK (score BETWEEN 0 AND 10),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);
-- Tai khoan dang nhap, 3 vai tro: admin / teacher / student
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role ENUM('admin','teacher','student') NOT NULL,
  student_id INT NULL,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);
CREATE TABLE subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  credits INT NOT NULL DEFAULT 3
);
ALTER TABLE classes ADD FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL;

INSERT INTO classes (name) VALUES ('DHTI15A'), ('DHTI15B');
INSERT INTO subjects (code, name, credits) VALUES
 ('TKHT','Trien khai he thong',3), ('CSDL','Co so du lieu',4),
 ('MMT','Mang may tinh',3), ('ATTT','An toan thong tin',2);
INSERT INTO students (code, full_name, email, class_id) VALUES
 ('SV001','Tran Thi B','sv001@example.com',1), ('SV002','Pham Van D','sv002@example.com',1),
 ('SV003','Le Minh E','sv003@example.com',2), ('SV004','Hoang Anh F','sv004@example.com',2);
INSERT INTO scores (student_id, subject, score) VALUES
 (1,'Trien khai he thong',9),(1,'Co so du lieu',8.5),(2,'Trien khai he thong',7),
 (2,'Co so du lieu',4.5),(3,'Trien khai he thong',6.5),(3,'Co so du lieu',8.25),
 (4,'Trien khai he thong',3.5),(4,'Co so du lieu',5);

