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
  MusicNotesSimple,
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
  musica: MusicNotesSimple,
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

/** Un reno visto de lado, mirando a la izquierda (trazo dorado). */
function Reno({ x, nariz }: { x: number; nariz?: boolean }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <ellipse cx="20" cy="17" rx="10" ry="4.6" />
      <path d="M12 15 L7 9" />
      <ellipse cx="5.5" cy="8" rx="3.3" ry="2.2" />
      <path d="M5 6 L3 1.5 M4 3.6 L1 3 M7 6 L9 1.5 M8.3 3 L11 2.6" fill="none" />
      <path d="M14 20 L9 25 M16.5 21 L15 27 M25 20 L29 24.5 M27 19 L32 22 M30 15 L33.5 12.5" fill="none" />
      {nariz && <circle cx="2.2" cy="8.6" r="1.6" fill="#ff4530" stroke="none" />}
    </g>
  );
}

/** Santa en su trineo cruzando el cielo de vez en cuando (decorativo, ver .santa en globals.css). */
export function Santa() {
  return (
    <div className="santa" aria-hidden>
      <div className="santa-flota">
        <svg viewBox="-2 -6 134 40" width="200" height="60" fill="currentColor" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <Reno x={0} nariz />
          <Reno x={38} />
          <path d="M32 13 Q60 21 90 17" fill="none" strokeWidth="0.9" />
          <path d="M88 14 Q90 26 104 26 L120 26 Q126 26 126 18 L126 10 L116 10 L116 18 L94 18 Q92 14 88 14 Z" />
          <path d="M84 30 L122 30 Q128 30 128 24" fill="none" />
          <circle cx="110" cy="11" r="5" />
          <circle cx="106" cy="4" r="2.7" />
          <path d="M104 2.5 L109 -2.5 L111.5 1" />
          <circle cx="109.3" cy="-3.2" r="1.3" fill="#fff1d6" stroke="none" />
          <circle cx="121" cy="7.5" r="5.2" />
        </svg>
        <span className="santa-estela" />
      </div>
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
