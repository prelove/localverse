export function renderFilterBar({ filters, labels }) {
  return `
    <div class="filter-bar">
      <select class="filter-type" value="${filters.type}">
        <option value="all">${labels.allTypes}</option>
        <option value="document">${labels.documents}</option>
        <option value="image">${labels.images}</option>
        <option value="code">${labels.code}</option>
        <option value="other">${labels.other}</option>
      </select>
    </div>
  `;
}
