(async () => {
  try {
    const { createApp } = require('../src/app')
    const app = await createApp()
    await app.close()
    console.log('app_ok')
  } catch (e) {
    console.error('app_err', e)
    process.exit(1)
  }
})()

