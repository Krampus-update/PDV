import { DEV_LOGIN, getDevPassword } from '../src/services/devAccessService.js';

const senha = await getDevPassword();

console.log('====================================');
console.log('Acesso DEV PDV');
console.log(`Login: ${DEV_LOGIN}`);
console.log(`Senha: ${senha}`);
console.log('====================================');
console.log('Use esse login na tela de acesso junto com o código do restaurante.');
