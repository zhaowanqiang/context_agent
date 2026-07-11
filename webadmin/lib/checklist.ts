/** checklist 头部的质检分（confirmOutline 拼入【质量自检】块，无独立表列） */
export function qualityOf(checklist: string | null | undefined): number | null {
  const m = checklist?.match(/【质量自检】([\d.]+)\/10/);
  return m ? Number(m[1]) : null;
}
