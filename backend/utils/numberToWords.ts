/**
 * Converts numbers to Indian Currency Words
 * Example: 4090 -> "Rupees Four Thousand Ninety Only"
 */

const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function convertChunk(num: number): string {
  let str = '';
  if (num >= 100) {
    str += `${units[Math.floor(num / 100)]} Hundred `;
    num %= 100;
  }
  if (num >= 20) {
    str += `${tens[Math.floor(num / 10)]} `;
    num %= 10;
  } else if (num >= 10) {
    str += `${teens[num - 10]} `;
    num = 0;
  }
  if (num > 0) {
    str += `${units[num]} `;
  }
  return str.trim();
}

export function numberToIndianWords(amount: number): string {
  if (isNaN(amount) || amount === 0) return 'Rupees Zero Only';

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  const rupees = Math.floor(absAmount);
  const paise = Math.round((absAmount - rupees) * 100);

  let words = '';

  const crore = Math.floor(rupees / 10000000);
  let remainder = rupees % 10000000;

  const lakh = Math.floor(remainder / 100000);
  remainder %= 100000;

  const thousand = Math.floor(remainder / 1000);
  remainder %= 1000;

  const hundreds = remainder;

  if (crore > 0) {
    words += `${convertChunk(crore)} Crore `;
  }
  if (lakh > 0) {
    words += `${convertChunk(lakh)} Lakh `;
  }
  if (thousand > 0) {
    words += `${convertChunk(thousand)} Thousand `;
  }
  if (hundreds > 0) {
    words += `${convertChunk(hundreds)} `;
  }

  words = words.trim();
  let result = words ? `Rupees ${words}` : 'Rupees Zero';

  if (paise > 0) {
    result += ` and ${convertChunk(paise)} Paise`;
  }

  result += ' Only';

  return isNegative ? `Minus ${result}` : result;
}
