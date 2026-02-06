function isSelected(current, value) {
  return current === value ? 'selected' : '';
}

export function renderFilterBar({ filters, labels }) {
  return `
    <div class="filter-bar">
      <select class="filter-type" value="${filters.type}">
        <option value="all" ${isSelected(filters.type, 'all')}>${labels.allTypes}</option>
        <option value="document" ${isSelected(filters.type, 'document')}>${labels.documents}</option>
        <option value="image" ${isSelected(filters.type, 'image')}>${labels.images}</option>
        <option value="code" ${isSelected(filters.type, 'code')}>${labels.code}</option>
        <option value="other" ${isSelected(filters.type, 'other')}>${labels.other}</option>
      </select>
      <select class="filter-size" value="${filters.sizeRange}">
        <option value="any" ${isSelected(filters.sizeRange, 'any')}>${labels.allSizes}</option>
        <option value="small" ${isSelected(filters.sizeRange, 'small')}>${labels.sizeSmall}</option>
        <option value="medium" ${isSelected(filters.sizeRange, 'medium')}>${labels.sizeMedium}</option>
        <option value="large" ${isSelected(filters.sizeRange, 'large')}>${labels.sizeLarge}</option>
      </select>
      <select class="filter-date" value="${filters.dateRange}">
        <option value="any" ${isSelected(filters.dateRange, 'any')}>${labels.allDates}</option>
        <option value="day" ${isSelected(filters.dateRange, 'day')}>${labels.dateDay}</option>
        <option value="week" ${isSelected(filters.dateRange, 'week')}>${labels.dateWeek}</option>
        <option value="month" ${isSelected(filters.dateRange, 'month')}>${labels.dateMonth}</option>
        <option value="year" ${isSelected(filters.dateRange, 'year')}>${labels.dateYear}</option>
      </select>
      <input class="filter-extension" type="text" value="${filters.extension || ''}" placeholder="${labels.extensionPlaceholder}" />
    </div>
  `;
}
