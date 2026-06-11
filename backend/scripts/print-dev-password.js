import { DEV_LOGIN, resetDevPassword } from '../src/services/devAccessService.js';

const { password } = await resetDevPassword();

console.log('====================================');
console.log('Senha DEV PDV redefinida');
console.log(`Login: ${DEV_LOGIN}`);
console.log(`Senha nova: ${password}`);
console.log('====================================');
console.log('Guarde essa senha agora. Ela nao fica salva em texto puro.');
