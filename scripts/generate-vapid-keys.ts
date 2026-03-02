import webPush from 'web-push'

const keys = webPush.generateVAPIDKeys()

console.log('VAPID Keys Generated:')
console.log('')
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`)
console.log('')
console.log('Add these to your Vercel environment variables.')
