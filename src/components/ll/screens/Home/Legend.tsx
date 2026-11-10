import Button from '@/components/Button';

type LegendProps = {
  title: string;
  children: React.ReactNode;

  // Lays the entries out in a row instead of one per line, using these flex
  // classes.
  flex?: string;
};

// Explains the symbols a screen uses: a titled, grouped list with one entry
// per symbol.
export default function Legend({ title, children, flex }: LegendProps) {
  return (
    <section>
      <h2 className="section-title mt-8">{title}</h2>
      <div className="list">
        <table className={flex ? 'block px-3.5 py-2' : 'w-full'}>
          <tbody className={flex ? `flex ${flex}` : ''}>{children}</tbody>
        </table>
      </div>
    </section>
  );
}

type SymbolProps = {
  sym: React.ReactNode;
  def: React.ReactNode;
  onInfo?: () => void;
};

export function Symbol({ sym, def, onInfo }: SymbolProps) {
  return (
    <tr className="border-line not-first:border-t">
      <td className="w-16 py-2.5 pl-3.5 font-semibold whitespace-nowrap">
        {sym}
      </td>
      <td className="py-2.5 pr-3.5 text-[15px]">{def}</td>
      {onInfo && (
        <td className="w-px py-2.5 pr-3.5">
          <Button type="small" onClick={onInfo}>
            Info
          </Button>
        </td>
      )}
    </tr>
  );
}
