import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/ui/form-input';
import { GlassCard } from '@/components/ui/glass-card';
import { Screen } from '@/components/ui/screen';
import { Brand, BREAKPOINTS, KpiAccent, Shape, Spacing, TouchTarget } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useDevices } from '@/context/device-context';
import { useTheme } from '@/hooks/use-theme';
import type {
  Device,
  DeviceCondition,
  DevicePaymentMethod,
  DeviceStatus,
} from '@/types/device';
import {
  calculateDeviceProfit,
  filterDevices,
  formatDeviceName,
  isDeviceWarrantyActive,
} from '@/utils/device-logic';
import { formatCOP, parseCOPInput } from '@/utils/format';

const CONDITIONS: DeviceCondition[] = [
  'Nuevo',
  'Usado - Excelente',
  'Usado - Bueno',
  'Para Repuestos',
];

const PAYMENT_METHODS: DevicePaymentMethod[] = ['Efectivo', 'Transferencia', 'Tarjeta'];

const STATUS_FILTERS: (DeviceStatus | 'Todos')[] = ['Todos', 'En Stock', 'Vendido'];

function notify(message: string) {
  if (Platform.OS === 'web') {
    window.alert(message);
  } else {
    Alert.alert('Aviso', message);
  }
}

export default function DevicesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= BREAKPOINTS.tablet; // 1024px
  const isTablet = width >= BREAKPOINTS.mobile; // 768px
  const kpiCardBasis = isDesktop ? '31%' : isTablet ? '48%' : '100%';

  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const { devices, metrics, addDevice, sellDevice, deleteDevice } = useDevices();

  // Estados de búsqueda y filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<DeviceStatus | 'Todos'>('Todos');

  // Formulario de Compra / Entrada de Stock
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [storageCapacity, setStorageCapacity] = useState('128GB');
  const [imei, setImei] = useState('');
  const [condition, setCondition] = useState<DeviceCondition>('Usado - Excelente');
  const [distributor, setDistributor] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [supplierWarrantyMonths, setSupplierWarrantyMonths] = useState('1');
  const [purchaseNotes, setPurchaseNotes] = useState('');
  const [isSubmittingBuy, setIsSubmittingBuy] = useState(false);

  // Formulario Inline de Venta (expandido por ID)
  const [sellingDeviceId, setSellingDeviceId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientDocument, setClientDocument] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [clientWarrantyMonths, setClientWarrantyMonths] = useState('3');
  const [paymentMethod, setPaymentMethod] = useState<DevicePaymentMethod>('Efectivo');
  const [saleNotes, setSaleNotes] = useState('');
  const [isSubmittingSale, setIsSubmittingSale] = useState(false);

  const filtered = useMemo(
    () => filterDevices(devices, searchQuery, selectedFilter),
    [devices, searchQuery, selectedFilter]
  );

  const handleAddDevice = async () => {
    if (!brand.trim() || !model.trim() || !imei.trim() || !distributor.trim() || !purchasePrice.trim()) {
      notify('Completa los campos obligatorios: Marca, Modelo, IMEI, Distribuidor y Costo.');
      return;
    }

    const priceNum = parseCOPInput(purchasePrice) ?? parseFloat(purchasePrice.replace(/[^0-9.]/g, ''));
    if (isNaN(priceNum) || priceNum <= 0) {
      notify('Ingresa un costo de compra válido en COP.');
      return;
    }

    const warrantyNum = parseInt(supplierWarrantyMonths, 10) || 0;

    setIsSubmittingBuy(true);
    try {
      const created = await addDevice({
        brand: brand.trim(),
        model: model.trim(),
        color: color.trim() || undefined,
        storageCapacity: storageCapacity.trim() || undefined,
        imei: imei.trim(),
        condition,
        distributor: distributor.trim(),
        purchasePrice: priceNum,
        supplierWarrantyMonths: warrantyNum,
        purchaseNotes: purchaseNotes.trim() || undefined,
      });

      if (created) {
        setBrand('');
        setModel('');
        setColor('');
        setStorageCapacity('128GB');
        setImei('');
        setDistributor('');
        setPurchasePrice('');
        setSupplierWarrantyMonths('1');
        setPurchaseNotes('');
      }
    } finally {
      setIsSubmittingBuy(false);
    }
  };

  const handleOpenSell = (device: Device) => {
    if (sellingDeviceId === device.id) {
      setSellingDeviceId(null);
      return;
    }
    setSellingDeviceId(device.id);
    setClientName('');
    setClientPhone('');
    setClientDocument('');
    setSalePrice('');
    setClientWarrantyMonths('3');
    setPaymentMethod('Efectivo');
    setSaleNotes('');
  };

  const handleConfirmSale = async (device: Device) => {
    if (!clientName.trim() || !salePrice.trim()) {
      notify('Por favor ingresa el nombre del cliente y el precio de venta.');
      return;
    }

    const priceNum = parseCOPInput(salePrice) ?? parseFloat(salePrice.replace(/[^0-9.]/g, ''));
    if (isNaN(priceNum) || priceNum <= 0) {
      notify('Ingresa un precio de venta válido en COP.');
      return;
    }

    const warrantyNum = parseInt(clientWarrantyMonths, 10) || 0;

    setIsSubmittingSale(true);
    try {
      const success = await sellDevice(device.id, {
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim() || undefined,
        clientDocument: clientDocument.trim() || undefined,
        salePrice: priceNum,
        clientWarrantyMonths: warrantyNum,
        paymentMethod,
        saleNotes: saleNotes.trim() || undefined,
      });

      if (success) {
        setSellingDeviceId(null);
      }
    } finally {
      setIsSubmittingSale(false);
    }
  };

  const handleDeleteDevice = (device: Device) => {
    const message = `¿Deseas eliminar el registro de ${device.brand} ${device.model} (IMEI: ${device.imei})?`;
    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        void deleteDevice(device.id);
      }
    } else {
      Alert.alert('Eliminar Registro', message, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => void deleteDevice(device.id) },
      ]);
    }
  };

  return (
    <Screen>
      {/* Encabezado estándar del proyecto */}
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          Compra y Venta de Equipos
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Control de celulares, stock por IMEI, garantías y facturación comercial
        </ThemedText>
      </View>

      {/* KPI Cards de Resumen Comercial con flexBasis y flexShrink: 0 */}
      <View style={styles.kpiGrid}>
        <GlassCard
          accent={KpiAccent.progress}
          style={[styles.kpiCard, { flexBasis: kpiCardBasis }]}>
          <View style={styles.kpiHeader}>
            <Ionicons name="phone-portrait-outline" size={20} color={Brand.primary} />
            <ThemedText type="small" themeColor="textSecondary">
              En Stock
            </ThemedText>
          </View>
          <ThemedText type="title" style={styles.kpiNumberPrimary}>
            {metrics.totalInStock}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Invertido: {formatCOP(metrics.totalInvestedStock)}
          </ThemedText>
        </GlassCard>

        <GlassCard
          accent={KpiAccent.ready}
          style={[styles.kpiCard, { flexBasis: kpiCardBasis }]}>
          <View style={styles.kpiHeader}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#059669" />
            <ThemedText type="small" themeColor="textSecondary">
              Equipos Vendidos
            </ThemedText>
          </View>
          <ThemedText type="title" style={styles.kpiNumberSuccess}>
            {metrics.totalSold}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Total Ventas: {formatCOP(metrics.totalRevenueSold)}
          </ThemedText>
        </GlassCard>

        <GlassCard
          accent={KpiAccent.ready}
          style={[styles.kpiCard, { flexBasis: kpiCardBasis }]}>
          <View style={styles.kpiHeader}>
            <Ionicons name="trending-up-outline" size={20} color="#2563eb" />
            <ThemedText type="small" themeColor="textSecondary">
              Utilidad Comercial
            </ThemedText>
          </View>
          <ThemedText type="title" style={styles.kpiNumberBlue}>
            {formatCOP(metrics.totalProfit)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Ganancia Neta Reventa
          </ThemedText>
        </GlassCard>
      </View>

      {/* Layout Principal: 2 columnas en Desktop (>=1024px) y Apilado en Tablet/Móvil */}
      <View style={[styles.mainRow, isDesktop && styles.mainRowDesktop]}>
        {/* Columna Formulario de Compra / Stock */}
        {isAdmin && (
          <ThemedView
            type="backgroundElement"
            style={[styles.formCard, isDesktop && styles.formCardDesktop]}>
            <ThemedText type="subtitle" style={styles.formTitle}>
              Registrar Compra de Equipo
            </ThemedText>

            <View style={styles.formGrid}>
              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <FormInput
                    label="Marca *"
                    placeholder="Ej. Apple"
                    value={brand}
                    onChangeText={setBrand}
                  />
                </View>
                <View style={styles.formCol}>
                  <FormInput
                    label="Modelo *"
                    placeholder="Ej. iPhone 13 Pro"
                    value={model}
                    onChangeText={setModel}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <FormInput
                    label="Capacidad"
                    placeholder="Ej. 128GB"
                    value={storageCapacity}
                    onChangeText={setStorageCapacity}
                  />
                </View>
                <View style={styles.formCol}>
                  <FormInput
                    label="Color"
                    placeholder="Ej. Azul Sierra"
                    value={color}
                    onChangeText={setColor}
                  />
                </View>
              </View>

              <FormInput
                label="IMEI / Serial *"
                placeholder="Número de IMEI del equipo"
                value={imei}
                onChangeText={setImei}
                keyboardType="numeric"
              />

              {/* Selector de Condición con Chips */}
              <View style={styles.conditionSection}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Condición del Equipo:
                </ThemedText>
                <View style={styles.conditionChips}>
                  {CONDITIONS.map((cond) => {
                    const isSelected = condition === cond;
                    return (
                      <Pressable
                        key={cond}
                        onPress={() => setCondition(cond)}
                        style={[
                          styles.condChip,
                          isSelected
                            ? { backgroundColor: Brand.primary, borderColor: Brand.primary }
                            : { backgroundColor: theme.surfaceContainer, borderColor: theme.border },
                        ]}>
                        <ThemedText
                          type="small"
                          style={{
                            color: isSelected ? Brand.onBrand : theme.textSecondary,
                            fontWeight: isSelected ? '700' : '500',
                          }}>
                          {cond}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <FormInput
                label="Distribuidor / Proveedor *"
                placeholder="Nombre de quien te lo vendió"
                value={distributor}
                onChangeText={setDistributor}
              />

              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <FormInput
                    label="Costo de Compra (COP) *"
                    placeholder="Ej. 1800000"
                    keyboardType="numeric"
                    value={purchasePrice}
                    onChangeText={setPurchasePrice}
                  />
                </View>
                <View style={styles.formCol}>
                  <FormInput
                    label="Garantía Proveedor (Meses)"
                    placeholder="Ej. 1"
                    keyboardType="numeric"
                    value={supplierWarrantyMonths}
                    onChangeText={setSupplierWarrantyMonths}
                  />
                </View>
              </View>

              <FormInput
                label="Observaciones (Opcional)"
                placeholder="Estado físico, batería, detalles..."
                value={purchaseNotes}
                onChangeText={setPurchaseNotes}
              />

              <Button
                label={isSubmittingBuy ? 'Guardando...' : '+ Registrar en Stock'}
                variant="primary"
                onPress={handleAddDevice}
                disabled={isSubmittingBuy}
                style={styles.addBtn}
              />
            </View>
          </ThemedView>
        )}

        {/* Columna Búsqueda, Filtros y Lista de Equipos */}
        <View style={[styles.listColumn, isDesktop && styles.listColumnDesktop]}>
          <FormInput
            label="Buscar equipos o ventas"
            placeholder="Buscar por IMEI, modelo, cliente o folio..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />

          {/* Chips de Filtro con Scroll Horizontal */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersScroll}>
            {STATUS_FILTERS.map((filter) => {
              const isSelected = selectedFilter === filter;
              return (
                <Pressable
                  key={filter}
                  onPress={() => setSelectedFilter(filter)}
                  style={[
                    styles.filterChip,
                    isSelected
                      ? { backgroundColor: Brand.primary, borderColor: Brand.primary }
                      : { backgroundColor: theme.surfaceContainer, borderColor: theme.border },
                  ]}>
                  <ThemedText
                    type="small"
                    style={[
                      styles.filterChipText,
                      { color: isSelected ? Brand.onBrand : theme.textSecondary },
                    ]}>
                    {filter}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Listado de Tarjetas de Equipos */}
          <View style={styles.devicesList}>
            {filtered.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.emptyContainer}>
                <Ionicons name="phone-portrait-outline" size={48} color={theme.textSecondary} />
                <ThemedText type="subtitle" style={styles.centerText}>
                  No hay equipos para mostrar
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.centerText}>
                  {searchQuery
                    ? 'No se encontraron coincidencias con tu búsqueda.'
                    : 'Ingresa tu primer equipo en el formulario de la izquierda.'}
                </ThemedText>
              </ThemedView>
            ) : (
              filtered.map((device) => {
                const isSold = device.status === 'Vendido';
                const isSelling = sellingDeviceId === device.id;
                const profit = isSold
                  ? calculateDeviceProfit(device.salePrice, device.purchasePrice)
                  : 0;
                const warrantyActive = isSold
                  ? isDeviceWarrantyActive(device.clientWarrantyExpiry)
                  : true;

                const liveProfit = salePrice
                  ? calculateDeviceProfit(parseCOPInput(salePrice) ?? parseFloat(salePrice), device.purchasePrice)
                  : 0;

                return (
                  <ThemedView key={device.id} type="backgroundElement" style={styles.deviceCard}>
                    {/* Encabezado del Equipo */}
                    <View style={styles.deviceHeader}>
                      <View style={styles.deviceTitleBlock}>
                        <ThemedText type="subtitle">
                          {formatDeviceName(device.brand, device.model, device.storageCapacity, device.color)}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          IMEI: <ThemedText type="smallBold">{device.imei}</ThemedText> • {device.condition}
                        </ThemedText>
                      </View>

                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor: isSold ? 'rgba(37,99,235,0.1)' : 'rgba(5,150,105,0.1)',
                            borderColor: isSold ? '#2563eb' : '#059669',
                          },
                        ]}>
                        <ThemedText
                          type="smallBold"
                          style={{ color: isSold ? '#2563eb' : '#059669' }}>
                          {device.status}
                        </ThemedText>
                      </View>
                    </View>

                    <View style={[styles.cardDivider, { backgroundColor: theme.border }]} />

                    {/* Información de Compra y Distribuidor */}
                    <View style={styles.metaRow}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Distribuidor: <ThemedText type="smallBold">{device.distributor}</ThemedText>
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Costo: <ThemedText type="smallBold">{formatCOP(device.purchasePrice)}</ThemedText>
                      </ThemedText>
                    </View>

                    {/* Bloque de Información de Venta */}
                    {isSold ? (
                      <View style={[styles.soldCard, { backgroundColor: theme.surfaceContainer }]}>
                        <View style={styles.metaRow}>
                          <ThemedText type="smallBold" style={{ color: Brand.primary }}>
                            Folio: {device.invoiceFolio || 'VNT-0000'}
                          </ThemedText>
                          <ThemedText type="small">
                            Vendido en: <ThemedText type="smallBold">{formatCOP(device.salePrice || 0)}</ThemedText>
                          </ThemedText>
                        </View>

                        <View style={styles.metaRow}>
                          <ThemedText type="small" themeColor="textSecondary">
                            Cliente: <ThemedText type="smallBold">{device.clientName}</ThemedText>
                          </ThemedText>
                          <ThemedText type="smallBold" style={{ color: '#059669' }}>
                            Utilidad: +{formatCOP(profit)}
                          </ThemedText>
                        </View>

                        <View style={styles.metaRow}>
                          <ThemedText type="small" themeColor="textSecondary">
                            Garantía ({device.clientWarrantyMonths}m): {device.clientWarrantyExpiry}
                          </ThemedText>
                          <ThemedText
                            type="smallBold"
                            style={{ color: warrantyActive ? '#059669' : '#dc2626' }}>
                            {warrantyActive ? 'Garantía Vigente' : 'Garantía Expirada'}
                          </ThemedText>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.metaRow}>
                        <ThemedText type="small" themeColor="textSecondary">
                          Garantía Proveedor: {device.supplierWarrantyMonths} meses
                        </ThemedText>
                        <ThemedText type="small" style={{ color: '#059669', fontWeight: '600' }}>
                          ✓ Disponible para Venta
                        </ThemedText>
                      </View>
                    )}

                    {/* Formulario Expandible Inline de Venta */}
                    {isSelling && !isSold && (
                      <View style={[styles.inlineSellBox, { borderColor: theme.border, backgroundColor: theme.surfaceContainer }]}>
                        <ThemedText type="smallBold" style={{ color: Brand.primary }}>
                          Registrar Venta de {device.brand} {device.model}
                        </ThemedText>

                        <View style={styles.sellProfitBadge}>
                          <ThemedText type="small">
                            Costo: {formatCOP(device.purchasePrice)}
                          </ThemedText>
                          <ThemedText
                            type="smallBold"
                            style={{ color: liveProfit > 0 ? '#059669' : theme.textSecondary }}>
                            Utilidad Estimada: +{formatCOP(liveProfit)}
                          </ThemedText>
                        </View>

                        <FormInput
                          label="Precio de Venta al Cliente (COP) *"
                          placeholder="Ej. 2300000"
                          keyboardType="numeric"
                          value={salePrice}
                          onChangeText={setSalePrice}
                        />

                        <FormInput
                          label="Nombre del Cliente *"
                          placeholder="Nombre completo"
                          value={clientName}
                          onChangeText={setClientName}
                        />

                        <View style={styles.formRow}>
                          <View style={styles.formCol}>
                            <FormInput
                              label="Cédula / Documento"
                              placeholder="Para factura"
                              keyboardType="numeric"
                              value={clientDocument}
                              onChangeText={setClientDocument}
                            />
                          </View>
                          <View style={styles.formCol}>
                            <FormInput
                              label="Teléfono WhatsApp"
                              placeholder="Para enviar PDF"
                              keyboardType="phone-pad"
                              value={clientPhone}
                              onChangeText={setClientPhone}
                            />
                          </View>
                        </View>

                        <FormInput
                          label="Garantía Otorgada (Meses) *"
                          placeholder="Ej. 3"
                          keyboardType="numeric"
                          value={clientWarrantyMonths}
                          onChangeText={setClientWarrantyMonths}
                        />

                        {/* Selector Método de Pago */}
                        <View style={styles.conditionSection}>
                          <ThemedText type="smallBold" themeColor="textSecondary">
                            Método de Pago:
                          </ThemedText>
                          <View style={styles.conditionChips}>
                            {PAYMENT_METHODS.map((pm) => {
                              const isSelected = paymentMethod === pm;
                              return (
                                <Pressable
                                  key={pm}
                                  onPress={() => setPaymentMethod(pm)}
                                  style={[
                                    styles.condChip,
                                    isSelected
                                      ? { backgroundColor: Brand.primary, borderColor: Brand.primary }
                                      : { backgroundColor: theme.surfaceContainerHigh, borderColor: theme.border },
                                  ]}>
                                  <ThemedText
                                    type="small"
                                    style={{
                                      color: isSelected ? Brand.onBrand : theme.textSecondary,
                                      fontWeight: isSelected ? '700' : '500',
                                    }}>
                                    {pm}
                                  </ThemedText>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>

                        <View style={styles.inlineSellActions}>
                          <Button
                            label="Cancelar"
                            variant="secondary"
                            onPress={() => setSellingDeviceId(null)}
                            style={{ flex: 1 }}
                          />
                          <Button
                            label={isSubmittingSale ? 'Confirmando...' : 'Confirmar Venta'}
                            variant="success"
                            onPress={() => void handleConfirmSale(device)}
                            disabled={isSubmittingSale}
                            style={{ flex: 2 }}
                          />
                        </View>
                      </View>
                    )}

                    {/* Botones de Acción de la Tarjeta */}
                    <View style={styles.cardActions}>
                      {!isSold ? (
                        <Button
                          label={isSelling ? 'Cerrar Venta' : '💵 Vender Equipo'}
                          variant={isSelling ? 'secondary' : 'primary'}
                          onPress={() => handleOpenSell(device)}
                          style={{ flex: 1 }}
                        />
                      ) : (
                        <Button
                          label="📄 Ver Factura / Compartir"
                          variant="primary"
                          onPress={() =>
                            router.push({
                              pathname: '/device-receipt/[id]',
                              params: { id: device.id },
                            })
                          }
                          style={{ flex: 1 }}
                        />
                      )}

                      {isAdmin && (
                        <Pressable
                          onPress={() => handleDeleteDevice(device)}
                          style={({ pressed }) => [
                            styles.deleteBtn,
                            pressed && { opacity: 0.7 },
                          ]}>
                          <Ionicons name="trash-outline" size={18} color="#dc2626" />
                        </Pressable>
                      )}
                    </View>
                  </ThemedView>
                );
              })
            )}
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    width: '100%',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
  },
  kpiGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    marginBottom: Spacing.two,
  },
  kpiCard: {
    flexGrow: 1,
    flexShrink: 0,
    minWidth: 220,
    padding: Spacing.three,
    borderRadius: Shape.lg,
    gap: Spacing.half,
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minWidth: 0,
  },
  kpiNumberPrimary: {
    color: Brand.primary,
    fontSize: 26,
    lineHeight: 30,
  },
  kpiNumberSuccess: {
    color: '#059669',
    fontSize: 26,
    lineHeight: 30,
  },
  kpiNumberBlue: {
    color: '#2563eb',
    fontSize: 26,
    lineHeight: 30,
  },
  mainRow: {
    width: '100%',
    gap: Spacing.four,
  },
  mainRowDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  formCard: {
    width: '100%',
    padding: Spacing.four,
    borderRadius: Shape.xl,
    gap: Spacing.three,
  },
  formCardDesktop: {
    width: '42%',
    minWidth: 320,
  },
  formTitle: {
    marginBottom: Spacing.one,
  },
  formGrid: {
    width: '100%',
    gap: Spacing.two,
  },
  formRow: {
    width: '100%',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  formCol: {
    flex: 1,
    minWidth: 0,
  },
  conditionSection: {
    width: '100%',
    gap: Spacing.one,
    marginVertical: 4,
  },
  conditionChips: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  condChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Shape.full,
    borderWidth: 1,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtn: {
    width: '100%',
    marginTop: Spacing.two,
  },
  listColumn: {
    width: '100%',
    gap: Spacing.three,
  },
  listColumnDesktop: {
    flex: 1,
    minWidth: 320,
  },
  searchInput: {
    width: '100%',
    paddingVertical: Spacing.two,
  },
  filtersScroll: {
    gap: Spacing.two,
    paddingBottom: Spacing.one,
  },
  filterChip: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    minHeight: TouchTarget.min,
    justifyContent: 'center',
    borderRadius: Shape.full,
    borderWidth: 1,
    overflow: 'hidden',
  },
  filterChipText: {
    fontWeight: '600',
    lineHeight: 18,
  },
  devicesList: {
    width: '100%',
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  emptyContainer: {
    width: '100%',
    padding: Spacing.six,
    borderRadius: Shape.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  centerText: {
    textAlign: 'center',
  },
  deviceCard: {
    width: '100%',
    padding: Spacing.four,
    borderRadius: Shape.xl,
    gap: Spacing.two,
  },
  deviceHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  deviceTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  statusBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Shape.sm,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    marginVertical: 2,
  },
  metaRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  soldCard: {
    width: '100%',
    padding: Spacing.three,
    borderRadius: Shape.md,
    gap: Spacing.one,
  },
  inlineSellBox: {
    width: '100%',
    padding: Spacing.three,
    borderRadius: Shape.lg,
    borderWidth: 1,
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  sellProfitBadge: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.half,
  },
  inlineSellActions: {
    width: '100%',
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  cardActions: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  deleteBtn: {
    padding: Spacing.two,
    borderRadius: Shape.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
