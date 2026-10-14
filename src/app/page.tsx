import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, ChevronDown, ClipboardList, FileSpreadsheet, MapPin, Plane } from "lucide-react";
import styles from "./home.module.css";
import ScrollReveal from "./ScrollReveal";

export const metadata: Metadata = {
  title: "TourFile | Operaciones turísticas, conectadas",
  description: "TourFile centraliza órdenes de servicio, control de vuelos y cajas chicas para equipos y operadores turísticos.",
  alternates: { canonical: "https://tourfile.lat/" },
};

const modules = [
  { icon: ClipboardList, name: "Órdenes de servicio", detail: "Los servicios de cada viaje, organizados y listos para coordinar." },
  { icon: Plane, name: "Control de vuelos", detail: "La información de los vuelos que forman parte de tus programas." },
  { icon: FileSpreadsheet, name: "Cajas chicas", detail: "Gastos operativos y reportes para tus rendiciones." },
];
const questions = [
  { question: "¿Qué es TourFile?", answer: "Es una plataforma para equipos y operadores turísticos. Reúne órdenes de servicio, control de vuelos y cajas chicas en un mismo lugar." },
  { question: "¿Cómo puedo empezar?", answer: <>Puedes <Link href="/register">crear una cuenta</Link> o <Link href="/login">entrar con tu cuenta actual</Link>. El acceso a cada módulo depende de los permisos asignados a tu usuario.</> },
  { question: "¿Quién está detrás del proyecto?", answer: "TourFile es un proyecto independiente creado en Bolivia. Comenzó en enero de 2025 y lanzó su aplicación en junio del mismo año." },
  { question: "¿Cómo puedo contactar a TourFile?", answer: <>Escribe a <a href="mailto:daniel.carrasco@tourfile.lat">daniel.carrasco@tourfile.lat</a> para conversar sobre tu operación o consultar acerca de la plataforma.</> },
];

export default function PublicHome() {
  return (
    <div className={styles.page}>
      <ScrollReveal />
      <section className={styles.hero} aria-labelledby="hero-title">
        <Image src="/la-paz.avif" alt="Paisaje de un lago y montañas bajo el cielo de Bolivia" fill priority sizes="100vw" className={styles.panorama} />
        <div className={styles.heroShade} aria-hidden="true" />
        <header className={styles.header}>
          <Link href="/" className={styles.brand} aria-label="TourFile, inicio"><Image src="/logo.png" width={30} height={30} alt="" /><span>TourFile</span></Link>
          <nav className={styles.navigation} aria-label="Navegación principal">
            <a href="#modulos">Módulos</a><a href="#nosotros">El proyecto</a><a href="#preguntas">Preguntas</a><a href="mailto:daniel.carrasco@tourfile.lat">Contacto</a>
          </nav>
          <Link href="/login" className={styles.signIn}>Entrar <ArrowRight size={14} /></Link>
        </header>
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>HECHO EN BOLIVIA. PENSADO PARA TU OPERACIÓN.</p>
          <h1 id="hero-title">Tu operación, en un mismo lugar.</h1>
          <p className={styles.heroIntro}>Menos información dispersa. Más claridad para coordinar servicios, vuelos, guías y gastos de cada viaje.</p>
          <div className={styles.heroActions}>
            <Link href="/login" className={styles.primary}>Entrar a TourFile <ArrowRight size={18} /></Link>
            <a href="#modulos" className={styles.explore}>Explorar los módulos <ArrowDown size={15} /></a>
          </div>
        </div>
        <div className={styles.heroFoot}><span><MapPin size={13} /> Bolivia · Desde 2025</span><a href="#modulos" aria-label="Descubrir los módulos de TourFile"><ArrowDown size={18} /></a><span>El viaje empieza mucho antes de salir.</span></div>
      </section>

      <main className={styles.main}>
        <section id="modulos" className={styles.tools} aria-labelledby="tools-title">
          <div className={styles.toolsHeading} data-reveal><p className={styles.sectionLabel}>01 / HERRAMIENTAS PARA EL DÍA A DÍA</p><h2 id="tools-title">Del primer servicio<br /><span>al cierre del mes.</span></h2><p>Cada parte de tu operación tiene su espacio.</p></div>
          <div className={styles.moduleGrid}>{modules.map(({icon: Icon, name, detail}, i) => <article key={name} className={styles.module} data-reveal data-reveal-delay={String(i)}><div className={styles.moduleTop}><Icon size={25} strokeWidth={1.5} /><span>0{i + 1}</span></div><h3>{name}</h3><p>{detail}</p></article>)}</div>
        </section>

        <section id="nosotros" className={styles.about} aria-labelledby="about-title">
          <p className={styles.sectionLabel} data-reveal>02 / DETRÁS DE TOURFILE</p>
          <div className={styles.aboutContent}><h2 id="about-title" data-reveal>Una idea simple.<br /><span>Hacer más fácil<br />la operación.</span></h2><div data-reveal data-reveal-delay="1"><p>TourFile es un proyecto independiente creado en Bolivia. Comenzó en enero de 2025 y lanzó su aplicación en junio del mismo año.</p><p>Desarrollamos herramientas para facilitar el trabajo de operadores turísticos y equipos de operaciones. Nuestro siguiente paso es explorar inteligencia artificial para el análisis de datos y el soporte dentro de la plataforma.</p><a href="mailto:daniel.carrasco@tourfile.lat" className={styles.textLink}>Hablemos de tu operación <ArrowRight size={17} /></a></div></div>
        </section>

        <section id="preguntas" className={styles.faq} aria-labelledby="faq-title"><div data-reveal><p className={styles.sectionLabel}>03 / RESOLVAMOS LAS DUDAS</p><h2 id="faq-title">Antes de<br /><span>empezar.</span></h2><p>Lo esencial sobre TourFile.</p></div><div className={styles.questions}>{questions.map(({question, answer}, i) => <details className={styles.question} key={question} data-reveal data-reveal-delay={String(i)}><summary><span className={styles.questionNumber}>0{i + 1}</span><span>{question}</span><ChevronDown size={18} /></summary><div className={styles.answer}>{answer}</div></details>)}</div></section>

        <section className={styles.closing} data-reveal><p className={styles.sectionLabel}>MENOS PENDIENTES. MÁS CLARIDAD.</p><h2>Tú haces posible el viaje.<br /><span>TourFile conecta lo que hay detrás.</span></h2><Link href="/login" className={styles.primary}>Entrar a TourFile <ArrowRight size={18} /></Link></section>
      </main>
      <footer className={styles.footer}><div className={styles.footerTop} data-reveal><div><Link href="/" className={styles.brand} aria-label="TourFile, inicio"><Image src="/logo.png" width={30} height={30} alt="" />TourFile</Link><p>Operaciones turísticas, conectadas.</p></div><nav aria-label="Navegación del pie de página"><a href="#modulos">Módulos</a><a href="#nosotros">El proyecto</a><a href="#preguntas">Preguntas</a><a href="mailto:daniel.carrasco@tourfile.lat">Contacto <ArrowRight size={14} /></a></nav></div><div className={styles.footerBottom} data-reveal><span>© {new Date().getFullYear()} TourFile</span><span>Hecho en Bolivia · Proyecto independiente</span></div></footer>
    </div>
  );
}
