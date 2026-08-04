import { bootstrap } from '@/bootstrap'
import { POST as loginPost } from '@helios/core/modules/auth/api/login'
export { metadata, openApi } from '@helios/core/modules/auth/api/login'

bootstrap()

export const POST = loginPost
