const { createApp } = require('./app')

;(async () => {
  const app = await createApp()
  const port = process.env.PORT ? Number(process.env.PORT) : 3000
  const host = process.env.HOST || '0.0.0.0'
  try {
    await app.listen({ port, host })
    app.log.info(`Sudoku API listening on http://${host}:${port}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
})()

