export default function FormInput({
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  icon,
  textarea,
  name,
  id,
  autoComplete,
  inputProps = {},
}) {
  const baseClass =
    'w-full rounded-xl border bg-[#ECECEF] px-4 py-2.5 text-sm placeholder:text-[#7E8599] text-[#2F3348] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 transition-shadow';
  const errorClass = error ? 'border-red-500 focus:ring-red-500/30' : 'border-[#D8D8D8]';

  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-[#111827]">{label}</label>}
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]">{icon}</div>}
        {textarea ? (
          <textarea
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            className={`${baseClass} ${errorClass} resize-none min-h-[82px]`}
          />
        ) : (
          <input
            id={id}
            name={name}
            type={type}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoComplete={autoComplete}
            className={`${baseClass} ${errorClass} ${icon ? 'pl-10' : ''}`}
            {...inputProps}
          />
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
