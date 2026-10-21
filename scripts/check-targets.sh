#!/bin/bash
curl -s http://localhost:9091/api/v1/targets | python3 -c "
import sys, json
for t in json.load(sys.stdin)['data']['activeTargets']:
    print(t['labels']['job'].ljust(12), t['health'].ljust(6), t['scrapeUrl'], '|', t['lastError'][:80])
"
