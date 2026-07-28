// Stub vacío para los tests.
//
// `server-only` no es un paquete instalado: solo existe dentro del bundler de
// Next. Es un centinela de build que impide que un módulo de servidor acabe en
// un bundle de cliente — una garantía del empaquetado, no del runtime. En Node
// no hay bundle de cliente que proteger, así que resolverlo a nada es correcto
// y no debilita ninguna comprobación real.
export {};
