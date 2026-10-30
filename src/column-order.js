export const statusIds = ['backlog','todo','progress','review','blocked','done'];
export function reorderColumns(items,id,targetId,after) {
 if (id === targetId) return items;
 const moved = items.find(item => item.id === id);
 const remaining = items.filter(item => item.id !== id);
 const target = remaining.findIndex(item => item.id === targetId);
 const position = after ? target+1 : target;
 remaining.splice(position,0,moved);
 return remaining;
}
