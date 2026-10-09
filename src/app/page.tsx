import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ClipboardList, FileSpreadsheet, Mail, Plane } from "lucide-react";
import styles from "./home.module.css";
import ScrollReveal from "./ScrollReveal";

export const metadata: Metadata = {
  title: "TourFile | Operaciones turísticas, conectadas",
  description: "TourFile centraliza órdenes de servicio, control de vuelos y cajas chicas para equipos y operadores turísticos. Conoce el proyecto y contacta a su fundador.",
  alternates: { canonical: "https://tourfile.lat/" },
};

// El color de cada módulo replica el del dashboard ((main)/home/page.tsx):
// Cajas Chicas = teal, Órdenes de Servicio = primary, Control de Vuelos = sky.
// `tone` fuerza el color en vez de dejarlo al :nth-child del CSS.
// OJO: el prefijo `tone` es obligatorio — una clase `primary` suelta
// colisiona con `.primary` (el botón) y pinta el artículo entero de azul.
const modules = [
  { icon: FileSpreadsheet, name: "Cajas chicas", tone: "toneTeal", detail: "Ordena los gastos operativos y la información que necesitas para tus rendiciones." },
  { icon: ClipboardList, name: "Órdenes de servicio", tone: "tonePrimary", detail: "Organiza los servicios de cada operación y mantén la información de tu equipo en un mismo lugar." },
  { icon: Plane, name: "Control de vuelos", tone: "toneSky", detail: "Consulta y coordina los vuelos que forman parte de tus programas turísticos." },
];

export default function PublicHome() {
  return (
      <div className={styles.page}>
        <ScrollReveal />
        <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="TourFile, inicio"><Image src="/logo.png" width={36} height={36} alt="" />TourFile</Link>
        <nav aria-label="Navegación principal"><a href="#modulos">Módulos</a><a href="#nosotros">Nosotros</a><Link href="/login" className={styles.enter}>Entrar <ArrowRight size={16} /></Link></nav>
      </header>
      <main>
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>TECNOLOGÍA PARA LA OPERACIÓN TURÍSTICA</p>
            <h1><span className={styles.heroBrand}><Image src="/logo.png" width={76} height={76} alt="" priority />TourFile</span><span>Tu operación,<br />en un mismo lugar.</span></h1>
            <p className={styles.intro}>Menos información dispersa. Más claridad para coordinar servicios, vuelos, guías y gastos de cada viaje.</p>
            <div className={styles.actions}><Link href="/login" className={styles.primary}>Entrar a TourFile <ArrowRight size={18} /></Link><a href="#modulos">Conocer los módulos <ArrowRight size={17} /></a></div>
          </div>
          <div className={styles.heroFoot}><span>Hecho en Bolivia. Pensado para operadores turísticos.</span><span>Desde 2025</span></div>
        </section>
        <section id="modulos" className={styles.modules}>
                  <div className={styles.sectionHeading} data-reveal><p className={styles.eyebrow}>EL DÍA A DÍA, CONECTADO</p><h2>Del primer servicio<br />al cierre del mes.</h2><p>Herramientas enfocadas en el trabajo de los equipos que hacen posible cada experiencia.</p></div>
                  <div className={styles.grid}>{modules.map(({ icon: Icon, name, tone, detail }, i) => <article key={name} data-reveal data-reveal-delay={String(i + 1)} className={`${styles.module} ${styles[tone]}`}><div className={styles.moduleTop}><Icon size={25} strokeWidth={1.6} /><span>0{i + 1}</span></div><h3>{name}</h3><p>{detail}</p></article>)}</div>
                </section>
        <section id="nosotros" className={styles.about}><div data-reveal><p className={styles.eyebrow}>DETRÁS DE TOURFILE</p><h2>Nace de una idea simple:<br />hacer más fácil la operación.</h2></div><div data-reveal data-reveal-delay="2"><p>TourFile es un proyecto independiente creado en Bolivia. Comenzó en enero de 2025 y lanzó su aplicación en junio del mismo año.</p><p>Desarrollamos herramientas para facilitar el trabajo de operadores turísticos y equipos de operaciones. Nuestro siguiente paso es explorar inteligencia artificial para el análisis de datos y el soporte dentro de la plataforma.</p><a href="mailto:daniel.carrasco@tourfile.lat" className={styles.contact}><Mail size={20} />daniel.carrasco@tourfile.lat <ArrowRight size={18} /></a></div></section>
                <section className={styles.closing}><div data-reveal><p className={styles.eyebrow}>HABLEMOS DE TU OPERACIÓN</p><h2>Cada viaje tiene mucho detrás.<br />Dale un lugar a todo.</h2><a className={styles.primary} href="mailto:daniel.carrasco@tourfile.lat">Contactar a TourFile <ArrowRight size={18} /></a></div></section>
              </main>
              <footer className={styles.footer} data-reveal><Link href="/" className={styles.footerBrand}><Image src="/logo.png" width={22} height={22} alt="" />TourFile</Link><span>Bolivia · Proyecto independiente</span><span>© {new Date().getFullYear()} TourFile</span></footer>
    </div>
  );
}
