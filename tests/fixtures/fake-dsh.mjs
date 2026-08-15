const delay = Number(process.env.FAKE_DSH_READY_DELAY_MS ?? 0)
setTimeout(() => {
  process.stdout.write(`dsh web: ${process.env.FAKE_DSH_URL ?? 'http://127.0.0.1:42000'}\n`)
  if (process.env.FAKE_DSH_EXIT_AFTER_READY === '1') process.exit(23)
}, delay)
setInterval(() => {}, 1_000)
