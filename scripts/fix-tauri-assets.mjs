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

html = html.split('\u0000').join('\\u0000')

writeFileSync(indexPath, html)
