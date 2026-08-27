import 'dotenv/config'
import express from 'express'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWebApp } from './app.js'
import { HttpPiApi } from './pi-api.js'

const port = Number(process.env.WEB_PORT ?? 3001)
const host = process.env.WEB_HOST ?? '0.0.0.0'
const piBaseUrl = process.env.PI_BASE_URL
const sessionSecret = process.env.WEB_SESSION_SECRET

if (!piBaseUrl || !sessionSecret) {
  throw new Error('PI_BASE_URL and WEB_SESSION_SECRET must be set before starting the web service')
}

const app = createWebApp({ piApi: new HttpPiApi(piBaseUrl), sessionSecret })
const projectDirectory = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const clientEntry = resolve(projectDirectory, 'dist', 'index.html')

if (existsSync(clientEntry)) {
  const clientDirectory = resolve(projectDirectory, 'dist')
  app.use(express.static(clientDirectory))
  app.use((request, response, next) => {
    if (request.method === 'GET' && !request.path.startsWith('/web-api')) {
      response.sendFile(clientEntry)
      return
    }
    next()
  })
}

app.listen(port, host, () => {
  console.log(`HuiQian web service is running at http://${host}:${port}`)
})
