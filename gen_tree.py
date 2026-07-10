import os

exclude = {'.git', 'node_modules', 'venv311', '__pycache__', '.venv', '.claude', '.github', '.vscode'}
out = []
for r, ds, fs in os.walk('.'):
    parts = r.split(os.sep)
    if any(p in exclude for p in parts):
        continue
    depth = 0 if r == '.' else r.count(os.sep) + 1
    dirs = sorted(d for d in ds if d not in exclude)
    files = sorted(f for f in fs if f not in exclude)
    for name in dirs:
        out.append(('  ' * depth) + '[DIR] ' + name)
    for name in files:
        out.append(('  ' * depth) + '[FILE] ' + name)

with open('system_tree.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))
print('Lines written:', len(out))