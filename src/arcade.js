export const COLS=7, ROWS=8;
export function adjacent(a,b){return a!==b && Math.abs(a%COLS-b%COLS)<=1 && Math.abs(Math.floor(a/COLS)-Math.floor(b/COLS))<=1;}
export function cluster(board,start){const found=new Set([start]),queue=[start],color=board[start]?.color;if(color==null)return [];while(queue.length){const a=queue.pop();for(let b=0;b<board.length;b++)if(!found.has(b)&&board[b]?.color===color&&adjacent(a,b)){found.add(b);queue.push(b);}}return [...found];}
export function collapse(board,create){const result=Array(board.length).fill(null);for(let x=0;x<COLS;x++){const cells=[];for(let y=ROWS-1;y>=0;y--)if(board[y*COLS+x])cells.push(board[y*COLS+x]);for(let y=ROWS-1;y>=0;y--)result[y*COLS+x]=cells[ROWS-1-y]||create();}return result;}
export function canPlay(board){return board.some((b,i)=>b&&(b.bomb||cluster(board,i).length>=3));}
export function points(count,combo,fever){return Math.round(count*100*(1+(count-3)*.25)*(1+Math.min(combo-1,9)*.2)*(fever?3:1));}
