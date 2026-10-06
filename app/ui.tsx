import Link from "next/link";
import {
  ArrowUpRight,
  CaretLeft,
  ChatCircle,
  Check,
  Copy,
  Fingerprint,
  Gift,
  GoogleLogo,
  Link as LinkIcon,
  PaperPlaneRight,
  Plus,
  TreeEvergreen,
  X,
} from "@phosphor-icons/react/ssr";

const iconos = {
  atras: CaretLeft,
  mas: Plus,
  x: X,
  chat: ChatCircle,
  regalo: Gift,
  enviar: PaperPlaneRight,
  link: LinkIcon,
  flecha: ArrowUpRight,
  huella: Fingerprint,
  google: GoogleLogo,
  copiar: Copy,
  check: Check,
  arbol: TreeEvergreen,
};

export function Icono({ n, className = "size-5" }: { n: keyof typeof iconos; className?: string }) {
  const I = iconos[n];
  return <I weight="light" className={className} aria-hidden />;
}

export function Barra({ atras, children }: { atras?: string; children?: React.ReactNode }) {
  return (
    <header className="vidrio sticky top-2 z-10 -mx-2 mb-6 flex h-16 items-center justify-between rounded-full px-3">
      {atras ? (
        <Link href={atras} prefetch={true} className="redondo" aria-label="Regresar">
          <Icono n="atras" className="size-[18px]" />
        </Link>
      ) : (
        <span className="flex items-center gap-1.5 pl-1 text-[15px] font-semibold tracking-tight">
          <Icono n="arbol" className="size-[18px] text-[#3fb37f]" /> GS
        </span>
      )}
      {children}
    </header>
  );
}

const COLORES_FOCO = ["#ff4530", "#f4c26b", "#3fb37f", "#fff1d6"];

/** Serie de luces navideñas colgando de lado a lado (decorativa). */
export function Serie() {
  return (
    <div className="serie" aria-hidden>
      {Array.from({ length: 12 }, (_, i) => (
        <span key={i}>
          <svg viewBox="0 0 100 34" preserveAspectRatio="none">
            <path d="M0 4 Q50 44 100 4" fill="none" stroke="#4a4b50" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
          </svg>
          <i className="foco" style={{ "--c": COLORES_FOCO[i % 4], "--i": i } as React.CSSProperties} />
        </span>
      ))}
    </div>
  );
}

/** Tarjeta de doble marco (DESIGN.md §4). */
export function Bezel({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`bezel ${className}`} style={style}>
      <div className="bezel-core">{children}</div>
    </div>
  );
}

export function ErrorMsg({ msg }: { msg?: string }) {
  return msg ? <p className="error mb-4" role="alert">{msg}</p> : null;
}
