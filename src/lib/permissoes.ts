// src/lib/permissoes.ts

export type Modulo = 'membros' | 'tesouraria' | 'patrimonio' | 'programacao' | 'escalas' | 'reunioes' | 'carteirinha';

type RegrasPerfil = {
  view: Modulo[];
  edit: Modulo[];
};

// Mapeamento exato das regras de negócio
const REGRAS_POR_PERFIL: Record<string, RegrasPerfil> = {
  'Secretário': {
    view: ['membros', 'patrimonio', 'programacao', 'escalas', 'reunioes', 'carteirinha'],
    edit: ['membros', 'patrimonio', 'programacao', 'escalas', 'reunioes'] // Tudo menos tesouraria
  },
  'Pastor/Presbítero': {
    view: ['membros', 'patrimonio', 'programacao', 'escalas', 'reunioes', 'carteirinha'],
    edit: ['membros', 'patrimonio', 'programacao', 'escalas', 'reunioes'] // Tudo menos tesouraria
  },
  'Tesoureiro': {
    view: ['membros', 'tesouraria', 'patrimonio', 'programacao', 'escalas', 'reunioes', 'carteirinha'],
    edit: ['tesouraria'] // Vê tudo, mas só edita tesouraria
  },
  'Patrimônio': {
    view: ['membros', 'patrimonio', 'programacao', 'escalas', 'reunioes', 'carteirinha'],
    edit: ['patrimonio'] // Não vê tesouraria. Só edita patrimônio
  },
  'Líder': {
    // Adicionado 'membros' para ele poder ver e editar o próprio perfil
    view: ['membros', 'programacao', 'escalas', 'carteirinha'], 
    edit: ['programacao', 'escalas']
  },
  'Membro': {
    // Adicionado 'membros' para ele poder acessar os próprios dados e carteirinha
    view: ['membros', 'carteirinha'], 
    edit: [] // Não edita módulos globais
  },
  'Congregado': {
    view: [], // O único que não visualiza membros nem carteirinha.
    edit: []
  }
};

/**
 * Função para verificar se o usuário tem permissão de visualizar um módulo
 * @param perfisUsuario Array de perfis do usuário (ex: ['Tesoureiro', 'Membro'])
 * @param modulo O módulo que queremos checar (ex: 'tesouraria')
 */
export function podeVisualizar(perfisUsuario: string[], modulo: Modulo): boolean {
  if (!perfisUsuario || perfisUsuario.length === 0) return false;
  
  // Administrador tem passe livre (caso exista esse perfil de sistema)
  if (perfisUsuario.includes('Administrador')) return true;

  return perfisUsuario.some(perfil => {
    const regras = REGRAS_POR_PERFIL[perfil];
    return regras?.view.includes(modulo) || regras?.edit.includes(modulo); // Quem edita, automaticamente visualiza
  });
}

/**
 * Função para verificar se o usuário tem permissão de criar/editar/excluir em um módulo
 * @param perfisUsuario Array de perfis do usuário (ex: ['Tesoureiro', 'Membro'])
 * @param modulo O módulo que queremos checar
 */
export function podeEditar(perfisUsuario: string[], modulo: Modulo): boolean {
  if (!perfisUsuario || perfisUsuario.length === 0) return false;
  
  // Administrador tem passe livre global
  if (perfisUsuario.includes('Administrador')) return true;

  return perfisUsuario.some(perfil => {
    const regras = REGRAS_POR_PERFIL[perfil];
    return regras?.edit.includes(modulo);
  });
}

/**
 * Pega um texto de perfis do banco (ex: "Líder,Membro") e transforma em Array
 */
export function formatarPerfis(perfisBanco: string | string[] | null | undefined): string[] {
  if (!perfisBanco) return [];
  if (Array.isArray(perfisBanco)) return perfisBanco;
  return perfisBanco.split(',').map(p => p.trim());
}