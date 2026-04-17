export function isSelfHosted(): boolean {
  return process.env.SELF_HOSTED === 'true'
}
