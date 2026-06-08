import { readFileSync, writeFileSync } from 'node:fs'

const indexPath = 'dist/client/index.html'
let html = readFileSync(indexPath, 'utf8')

const replacements = [
  ['="/./assets/', '="./assets/'],
  ['="/assets/', '="./assets/'],
  ['="/manifest.json"', '="./manifest.json"'],
  ['="/logo192.png"', '="./logo192.png"'],
  ['"/./assets/', '"./assets/'],
  ['"/assets/', '"./assets/'],
]

for (const [from, to] of replacements) {
  html = html.split(from).join(to)
}

writeFileSync(indexPath, html)
