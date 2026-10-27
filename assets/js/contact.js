// Replace this adapter when a form delivery service is connected.
export const SUBMIT_MODE = 'mailto';
export function buildMailto(values, email = 'theojeon@semilabglobal.com') {
  const subject = `[SEMI LINK] ${values.company || ''} / ${values.part || '부품 상담'}`;
  const body = [
    `회사명 / Company: ${values.company || ''}`, `담당자 / Name: ${values.name || ''}`,
    `이메일 / Email: ${values.email || ''}`, `전화 / Phone: ${values.phone || ''}`,
    `관심 품목·품번 / Part: ${values.part || ''}`, `수량 / Quantity: ${values.quantity || ''}`,
    '', values.message || '', '', '개인정보 수집·이용 동의 / Privacy consent: Yes'
  ].join('\n');
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
export function submitContact(values, email) {
  if (!values.privacy) throw new Error('Privacy consent required');
  if (SUBMIT_MODE === 'mailto') return {url:buildMailto(values, email), mode:SUBMIT_MODE};
  throw new Error('Unsupported submission mode');
}
