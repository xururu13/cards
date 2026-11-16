import { OptionChips } from '@/components/option-chips';
import { LANGUAGES } from '@/constants/languages';

const OPTIONS = LANGUAGES.map((lang) => ({ value: lang.code, label: lang.label }));

export function LanguageChips({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  return <OptionChips options={OPTIONS} value={value} onChange={onChange} />;
}
