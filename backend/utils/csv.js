function escapeCsvField(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(rows, columns) {
  const header = columns.map((c) => escapeCsvField(c.label)).join(',');
  const body = rows
    .map((row) => columns.map((c) => escapeCsvField(c.value(row))).join(','))
    .join('\n');

  return `${header}\n${body}\n`;
}

module.exports = { toCsv };
