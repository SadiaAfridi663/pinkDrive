const COLORS = [
  '#e91e8c', '#1565c0', '#2e7d32', '#f57c00', '#6a1b9a',
  '#00838f', '#d84315', '#283593', '#558b2f', '#ad1457',
];

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < (str || '').length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function Avatar({ name = '?', size = 'md', src, className = '' }) {
  const initial = (name || '?').charAt(0).toUpperCase();
  const bg = COLORS[hashCode(name) % COLORS.length];

  const sizeMap = { sm: 'w-7 h-7 text-[0.7rem]', md: 'w-9 h-9 text-sm', lg: 'w-12 h-12 text-base' };
  const dim = sizeMap[size] || sizeMap.md;

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${dim} rounded-full  object-cover flex-shrink-0 ${className}`}
      />
    );
  }

  return (
    <span
      className={`${dim} rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0 ${className}`}
      style={{ backgroundColor: bg }}
      title={name}
    >
      {initial}
    </span>
  );
}

export default Avatar;
