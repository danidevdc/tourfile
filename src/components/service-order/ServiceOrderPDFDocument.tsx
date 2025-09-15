
"use client";

import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';
import { StoredServiceOrder } from '@/lib/serviceOrderStorage';
import { parse } from 'date-fns';

// Register fonts - it's important to do this once.
// Using a stable URL from a CDN is a good practice.
Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf' },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf', fontWeight: 'bold' },
  ],
});

const styles = StyleSheet.create({
    page: {
        fontFamily: 'Roboto',
        padding: 20,
        backgroundColor: '#fff',
        color: '#111',
        fontSize: 9,
        textTransform: 'uppercase',
    },
    title: {
        fontSize: 18,
        textAlign: 'center',
        fontWeight: 'bold',
        marginBottom: 10,
    },
    container: {
        border: '2px solid #a0a0a0',
        borderRadius: 8,
        padding: 16,
    },
    infoTable: {
        marginBottom: 16,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    infoLabel: {
        fontWeight: 'bold',
        width: 96,
    },
    infoValue: {
        flex: 1,
        border: '1px solid #d1d1d1',
        borderRadius: 4,
        backgroundColor: '#f8f8f8',
        padding: 5,
    },
    servicesTableWrapper: {
        border: '1px solid #d1d1d1',
        borderRadius: 8,
        overflow: 'hidden',
    },
    table: {
        display: "flex",
        width: "auto",
        flexDirection: 'column',
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f1f1f1',
        borderBottom: '1px solid #d1d1d1',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottom: '1px dotted #d1d1d1',
    },
    tableCol: {
        padding: 4,
        borderRight: '1px solid #d1d1d1',
        wordWrap: 'break-word',
        textAlign: 'left',
        verticalAlign: 'middle',
    },
    dateCell: { width: '10%', textAlign: 'center', fontWeight: 'bold' },
    timeCell: { width: '6%', textAlign: 'center' },
    serviceCell: { width: '28%' },
    flightCell: { width: '9%', textAlign: 'center' },
    guideCell: { width: '10%', textAlign: 'center' },
    busCell: { width: '8%', textAlign: 'center' },
    driverCell: { width: '9%', textAlign: 'center' },
    obsCell: { flex: 1, borderRight: 0 },
    footerBlocks: {
        marginTop: 16,
    },
    infoBlock: {
        border: '1px solid #d1d1d1',
        borderRadius: 4,
        padding: 8,
        backgroundColor: '#f8f8f8',
        marginBottom: 10,
    },
    infoBlockTitle: {
        fontWeight: 'bold',
        marginBottom: 4,
        fontSize: 10,
    },
    infoBlockText: {
        fontSize: 9,
    },
});

interface ServiceOrderPDFDocumentProps {
  order: StoredServiceOrder;
}

const ServiceOrderPDFDocument: React.FC<ServiceOrderPDFDocumentProps> = ({ order }) => {
    const { data } = order;

    const sortedServices = [...(data.services || [])].sort((a, b) => {
        try {
            const dateA = parse(a.fecha, "dd/MM/yyyy", new Date()).getTime();
            const dateB = parse(b.fecha, "dd/MM/yyyy", new Date()).getTime();
            if (dateA !== dateB) return dateA - dateB;
        } catch {}
        const hasTimeA = a.hora && a.hora.trim() !== '';
        const hasTimeB = b.hora && b.hora.trim() !== '';
        if (hasTimeA && hasTimeB) return a.hora.localeCompare(b.hora);
        if (hasTimeA) return -1;
        if (hasTimeB) return 1;
        return 0;
    });

    return (
        <Document>
            <Page size="A4" orientation="landscape" style={styles.page}>
                <Text style={styles.title}>ORDEN DE SERVICIO</Text>
                <View style={styles.container}>
                    <View style={styles.infoTable}>
                        <View style={styles.infoRow}><Text style={styles.infoLabel}>Guía:</Text><Text style={styles.infoValue}>{data.guia || "—"}</Text></View>
                        <View style={styles.infoRow}><Text style={styles.infoLabel}>File:</Text><Text style={styles.infoValue}>{data.file || "—"}</Text></View>
                        <View style={styles.infoRow}><Text style={styles.infoLabel}>Ref:</Text><Text style={styles.infoValue}>{data.ref || "—"}</Text></View>
                        <View style={styles.infoRow}><Text style={styles.infoLabel}>Nº Pax:</Text><Text style={styles.infoValue}>{data.nPax || "—"}</Text></View>
                        <View style={styles.infoRow}><Text style={styles.infoLabel}>Hotel:</Text><Text style={styles.infoValue}>{data.hotel || "—"}</Text></View>
                    </View>
                    
                    <View style={styles.servicesTableWrapper}>
                        <View style={styles.table}>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.tableCol, styles.dateCell]}>Fecha</Text>
                                <Text style={[styles.tableCol, styles.timeCell]}>Hora</Text>
                                <Text style={[styles.tableCol, styles.serviceCell]}>Servicio</Text>
                                <Text style={[styles.tableCol, styles.flightCell]}>Vuelo</Text>
                                <Text style={[styles.tableCol, styles.guideCell]}>Guía</Text>
                                <Text style={[styles.tableCol, styles.busCell]}>Bus</Text>
                                <Text style={[styles.tableCol, styles.driverCell]}>Chofer</Text>
                                <Text style={[styles.tableCol, styles.obsCell]}>Observaciones</Text>
                            </View>
                            {sortedServices.map((s, i) => {
                                const showDate = i === 0 || (sortedServices[i - 1] && sortedServices[i - 1].fecha !== s.fecha);
                                const guiaCompleto = s.guia || data.guia;
                                const guiaFirstName = (guiaCompleto || '').split(' ')[0];
                                const choferCompleto = s.chofer || '';
                                const choferSanitized = choferCompleto.replace(/^CONT\s/i, '');
                                const choferFirstName = choferSanitized.split(' ')[0];
                                return (
                                    <View key={i} style={styles.tableRow}>
                                        <Text style={[styles.tableCol, styles.dateCell]}>{showDate && s.fecha ? s.fecha : ""}</Text>
                                        <Text style={[styles.tableCol, styles.timeCell]}>{s.hora || ''}</Text>
                                        <Text style={[styles.tableCol, styles.serviceCell]}>{s.servicio || ''}</Text>
                                        <Text style={[styles.tableCol, styles.flightCell]}>{s.vuelo || "—"}</Text>
                                        <Text style={[styles.tableCol, styles.guideCell]}>{guiaFirstName}</Text>
                                        <Text style={[styles.tableCol, styles.busCell]}>{s.bus || ''}</Text>
                                        <Text style={[styles.tableCol, styles.driverCell]}>{choferFirstName}</Text>
                                        <Text style={[styles.tableCol, styles.obsCell]}>{s.observaciones || ''}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>

                    <View style={styles.footerBlocks}>
                        <View style={styles.infoBlock}>
                            <Text style={styles.infoBlockTitle}>OBSERVACIONES:</Text>
                            <Text style={styles.infoBlockText}>{data.observations || "—"}</Text>
                        </View>
                        <View style={styles.infoBlock}>
                            <Text style={styles.infoBlockTitle}>NOTA:</Text>
                            <Text style={styles.infoBlockText}>{data.nota || "—"}</Text>
                        </View>
                    </View>
                </View>
            </Page>
        </Document>
    );
};

export default ServiceOrderPDFDocument;
