// Função auxiliar para formatar uma data para o timezone WIB (UTC+7)
export function formatDateToWIB(date: Date): string {
  // Adiciona 7 horas para converter para WIB (UTC+7)
  const wibDate = new Date(date.getTime() + (7 * 60 * 60 * 1000));
  
  // Formata a data no formato YYYY-MM-DD HH:MM:SS
  const year = wibDate.getUTCFullYear();
  const month = String(wibDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(wibDate.getUTCDate()).padStart(2, '0');
  const hours = String(wibDate.getUTCHours()).padStart(2, '0');
  const minutes = String(wibDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(wibDate.getUTCSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} WIB`;
}