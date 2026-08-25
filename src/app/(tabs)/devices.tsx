import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import { GlassCard } from '@/components/ui/glass-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/ui/form-input';
import { Screen } from '@/components/ui/screen';
import { Brand, BREAKPOINTS, Shape, Spacing } from '@/constants/theme';
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
import { formatCOP } from '@/utils/format';

function notify(message: string) {
  if (Platform.OS === 'web') {
    window.alert(message);
  } else {
    Alert.alert('Aviso', message);
  }
}

const CONDITIONS: DeviceCondition[] = [
  'Nuevo',
  'Usado - Excelente',
  'Usado - Bueno',
  'Para Repuestos',
];

const PAYMENT_METHODS: DevicePaymentMethod[] = ['Efectivo', 'Transferencia', 'Tarjeta'];

export default function DevicesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isTablet = width >= BREAKPOINTS.tablet;
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const { devices, metrics, addDevice, sellDevice, deleteDevice } = useDevices();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<DeviceStatus | 'Todos'>('Todos');

  // Modal de Compra / Registro de Equipo
  const [buyModalVisible, setBuyModalVisible] = useState(false);
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

  // Modal de Venta de Equipo
  const [sellModalVisible, setSellModalVisible] = useState(false);
  const [selectedDeviceToSell, setSelectedDeviceToSell] = useState<Device | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientDocument, setClientDocument] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [clientWarrantyMonths, setClientWarrantyMonths] = useState('3');
  const [paymentMethod, setPaymentMethod] = useState<DevicePaymentMethod>('Efectivo');
  const [saleNotes, setSaleNotes] = useState('');
  const [isSubmittingSale, setIsSubmittingSale] = useState(false);

  const filtered = filterDevices(devices, searchQuery, statusFilter);

  const handleOpenBuyModal = () => {
    setBrand('');
    setModel('');
    setColor('');
    setStorageCapacity('128GB');
    setImei('');
    setCondition('Usado - Excelente');
    setDistributor('');
    setPurchasePrice('');
    setSupplierWarrantyMonths('1');
    setPurchaseNotes('');
    setBuyModalVisible(true);
  };

  const handleSaveBuy = async () => {
    if (!brand.trim() || !model.trim() || !imei.trim() || !distributor.trim() || !purchasePrice.trim()) {
      notify('Por favor complete los campos obligatorios: Marca, Modelo, IMEI, Distribuidor y Costo.');
      return;
    }

    const priceNum = parseFloat(purchasePrice.replace(/[^0-9.]/g, ''));
    if (isNaN(priceNum) || priceNum <= 0) {
      notify('Ingrese un costo de compra válido en COP.');
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
        setBuyModalVisible(false);
      }
    } finally {
      setIsSubmittingBuy(false);
    }
  };

  const handleOpenSellModal = (device: Device) => {
    setSelectedDeviceToSell(device);
    setClientName('');
    setClientPhone('');
    setClientDocument('');
    setSalePrice('');
    setClientWarrantyMonths('3');
    setPaymentMethod('Efectivo');
    setSaleNotes('');
    setSellModalVisible(true);
  };

  const handleSaveSale = async () => {
    if (!selectedDeviceToSell) return;

    if (!clientName.trim() || !salePrice.trim()) {
      notify('Por favor ingrese el nombre del cliente y el precio de venta.');
      return;
    }

    const priceNum = parseFloat(salePrice.replace(/[^0-9.]/g, ''));
    if (isNaN(priceNum) || priceNum <= 0) {
      notify('Ingrese un precio de venta válido en COP.');
      return;
    }

    const warrantyNum = parseInt(clientWarrantyMonths, 10) || 0;

    setIsSubmittingSale(true);
    try {
      const success = await sellDevice(selectedDeviceToSell.id, {
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim() || undefined,
        clientDocument: clientDocument.trim() || undefined,
        salePrice: priceNum,
        clientWarrantyMonths: warrantyNum,
        paymentMethod,
        saleNotes: saleNotes.trim() || undefined,
      });

      if (success) {
        setSellModalVisible(false);
        setSelectedDeviceToSell(null);
      }
    } finally {
      setIsSubmittingSale(false);
    }
  };

  const handleDeleteDevice = (device: Device) => {
    const message = `¿Deseas eliminar el registro de este equipo (${device.brand} ${device.model} - IMEI: ${device.imei})?`;
    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        void deleteDevice(device.id);
      }
    } else {
      Alert.alert('Eliminar Equipo', message, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => void deleteDevice(device.id) },
      ]);
    }
  };

  const currentEstimatedProfit = selectedDeviceToSell && salePrice
    ? calculateDeviceProfit(parseFloat(salePrice.replace(/[^0-9.]/g, '')), selectedDeviceToSell.purchasePrice)
    : 0;

  return (
    <Screen>
      {/* Encabezado */}
      <View style={styles.header}>
        <View>
          <ThemedText type="title" style={styles.title}>
            Compra y Venta de Equipos
          </ThemedText>
          <ThemedText themeColor="textSecondary">
            Gestión comercial de teléfonos, IMEI, garantías y facturación
          </ThemedText>
        </View>
        <Button
          label="+ Registrar Compra"
          variant="primary"
          onPress={handleOpenBuyModal}
          style={styles.buyButton}
        />
      </View>

      {/* Tarjetas de Métricas de Venta de Equipos (Aisladas) */}
      <View style={[styles.metricsRow, isTablet && styles.metricsRowTablet]}>
        <GlassCard style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <Ionicons name="phone-portrait-outline" size={20} color={Brand.primary} />
            <ThemedText type="small" themeColor="textSecondary">
              En Stock
            </ThemedText>
          </View>
          <ThemedText type="title" style={{ color: Brand.primary }}>
            {metrics.totalInStock}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Inversión: {formatCOP(metrics.totalInvestedStock)}
          </ThemedText>
        </GlassCard>

        <GlassCard style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#059669" />
            <ThemedText type="small" themeColor="textSecondary">
              Equipos Vendidos
            </ThemedText>
          </View>
          <ThemedText type="title" style={{ color: '#059669' }}>
            {metrics.totalSold}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Ventas: {formatCOP(metrics.totalRevenueSold)}
          </ThemedText>
        </GlassCard>

        <GlassCard style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <Ionicons name="trending-up-outline" size={20} color="#2563eb" />
            <ThemedText type="small" themeColor="textSecondary">
              Utilidad Comercial
            </ThemedText>
          </View>
          <ThemedText type="title" style={{ color: '#2563eb' }}>
            {formatCOP(metrics.totalProfit)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Ganancia Neta Reventa
          </ThemedText>
        </GlassCard>
      </View>

      {/* Barra de Búsqueda y Filtros */}
      <View style={styles.searchSection}>
        <FormInput
          label="Buscar Equipo o Venta"
          placeholder="Buscar por IMEI, Modelo, Cliente o Folio..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
        />

        <View style={styles.filterChips}>
          {(['Todos', 'En Stock', 'Vendido'] as (DeviceStatus | 'Todos')[]).map((st) => {
            const isSelected = statusFilter === st;
            return (
              <Pressable
                key={st}
                onPress={() => setStatusFilter(st)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isSelected ? Brand.primary : theme.surfaceContainer,
                    borderColor: isSelected ? Brand.primary : theme.border,
                  },
                ]}>
                <ThemedText
                  type="smallBold"
                  style={{ color: isSelected ? '#ffffff' : theme.textSecondary }}>
                  {st}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Listado de Equipos */}
      {filtered.length === 0 ? (
        <ThemedView type="backgroundElement" style={styles.emptyContainer}>
          <Ionicons name="phone-portrait-outline" size={48} color={theme.textSecondary} />
          <ThemedText type="subtitle">No hay equipos para mostrar</ThemedText>
          <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }}>
            {searchQuery
              ? 'No se encontraron resultados con ese criterio de búsqueda.'
              : 'Presiona "+ Registrar Compra" para ingresar tu primer celular al stock.'}
          </ThemedText>
        </ThemedView>
      ) : (
        <View style={styles.listGrid}>
          {filtered.map((device) => {
            const isSold = device.status === 'Vendido';
            const profit = isSold
              ? calculateDeviceProfit(device.salePrice, device.purchasePrice)
              : 0;
            const warrantyActive = isSold
              ? isDeviceWarrantyActive(device.clientWarrantyExpiry)
              : true;

            return (
              <GlassCard key={device.id} style={styles.deviceCard}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
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

                {/* Detalles de Compra / Stock */}
                <View style={styles.infoRow}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Distribuidor: {device.distributor}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Costo: <ThemedText type="smallBold">{formatCOP(device.purchasePrice)}</ThemedText>
                  </ThemedText>
                </View>

                {/* Detalles de Venta si está vendido */}
                {isSold ? (
                  <View style={styles.soldSection}>
                    <View style={styles.infoRow}>
                      <ThemedText type="smallBold" style={{ color: Brand.primary }}>
                        Folio: {device.invoiceFolio || 'VNT-0000'}
                      </ThemedText>
                      <ThemedText type="small">
                        Vendido: <ThemedText type="smallBold">{formatCOP(device.salePrice || 0)}</ThemedText>
                      </ThemedText>
                    </View>
                    <View style={styles.infoRow}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Cliente: {device.clientName}
                      </ThemedText>
                      <ThemedText type="smallBold" style={{ color: '#059669' }}>
                        Utilidad: +{formatCOP(profit)}
                      </ThemedText>
                    </View>
                    <View style={styles.infoRow}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Garantía ({device.clientWarrantyMonths}m): {device.clientWarrantyExpiry}
                      </ThemedText>
                      <ThemedText
                        type="smallBold"
                        style={{ color: warrantyActive ? '#059669' : '#dc2626' }}>
                        {warrantyActive ? 'Vigente' : 'Expirada'}
                      </ThemedText>
                    </View>
                  </View>
                ) : (
                  <View style={styles.inStockInfo}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Garantía Proveedor: {device.supplierWarrantyMonths} meses
                    </ThemedText>
                    <ThemedText type="small" style={{ color: '#059669' }}>
                      Listo para vender
                    </ThemedText>
                  </View>
                )}

                {/* Botones de Acción */}
                <View style={styles.cardActions}>
                  {!isSold ? (
                    <Button
                      label="💵 Vender Equipo"
                      variant="primary"
                      onPress={() => handleOpenSellModal(device)}
                      style={styles.cardBtn}
                    />
                  ) : (
                    <Button
                      label="📄 Ver Factura / Enviar"
                      variant="primary"
                      onPress={() =>
                        router.push({
                          pathname: '/device-receipt/[id]',
                          params: { id: device.id },
                        })
                      }
                      style={styles.cardBtn}
                    />
                  )}

                  {isAdmin && (
                    <Pressable
                      onPress={() => handleDeleteDevice(device)}
                      style={styles.deleteIconButton}>
                      <Ionicons name="trash-outline" size={18} color="#dc2626" />
                    </Pressable>
                  )}
                </View>
              </GlassCard>
            );
          })}
        </View>
      )}

      {/* MODAL: Registrar Compra / Ingreso de Equipo */}
      <Modal visible={buyModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">Registrar Compra de Equipo</ThemedText>
              <Pressable onPress={() => setBuyModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGrid}>
                <FormInput
                  label="Marca *"
                  placeholder="Ej: Apple, Samsung, Xiaomi"
                  value={brand}
                  onChangeText={setBrand}
                />
                <FormInput
                  label="Modelo *"
                  placeholder="Ej: iPhone 13 Pro Max, Galaxy S23"
                  value={model}
                  onChangeText={setModel}
                />
                <FormInput
                  label="Capacidad / Memoria"
                  placeholder="Ej: 128GB, 256GB"
                  value={storageCapacity}
                  onChangeText={setStorageCapacity}
                />
                <FormInput
                  label="Color"
                  placeholder="Ej: Azul Sierra, Negro grafito"
                  value={color}
                  onChangeText={setColor}
                />
                <FormInput
                  label="IMEI / Serial *"
                  placeholder="Número de IMEI del equipo"
                  value={imei}
                  onChangeText={setImei}
                  keyboardType="numeric"
                />
                
                {/* Selector de Condición */}
                <View style={styles.fieldGroup}>
                  <ThemedText type="smallBold" style={styles.fieldLabel}>Condición del Equipo</ThemedText>
                  <View style={styles.chipsRow}>
                    {CONDITIONS.map((cond) => (
                      <Pressable
                        key={cond}
                        onPress={() => setCondition(cond)}
                        style={[
                          styles.chipSmall,
                          {
                            backgroundColor: condition === cond ? Brand.primary : theme.surfaceContainer,
                            borderColor: condition === cond ? Brand.primary : theme.border,
                          },
                        ]}>
                        <ThemedText
                          type="small"
                          style={{ color: condition === cond ? '#ffffff' : theme.textSecondary }}>
                          {cond}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <FormInput
                  label="Distribuidor / Proveedor *"
                  placeholder="Nombre de quien te vendió el equipo"
                  value={distributor}
                  onChangeText={setDistributor}
                />
                <FormInput
                  label="Costo de Compra (COP) *"
                  placeholder="Ej: 1800000"
                  value={purchasePrice}
                  onChangeText={setPurchasePrice}
                  keyboardType="numeric"
                />
                <FormInput
                  label="Garantía de Proveedor (Meses)"
                  placeholder="Ej: 1, 3, 6"
                  value={supplierWarrantyMonths}
                  onChangeText={setSupplierWarrantyMonths}
                  keyboardType="numeric"
                />
                <FormInput
                  label="Notas de Compra (Opcional)"
                  placeholder="Detalles sobre el estado o procedencia..."
                  value={purchaseNotes}
                  onChangeText={setPurchaseNotes}
                  multiline
                />
              </View>

              <View style={styles.modalActions}>
                <Button
                  label="Cancelar"
                  variant="secondary"
                  onPress={() => setBuyModalVisible(false)}
                  style={styles.modalBtn}
                />
                <Button
                  label={isSubmittingBuy ? 'Guardando...' : 'Registrar en Stock'}
                  variant="primary"
                  onPress={handleSaveBuy}
                  disabled={isSubmittingBuy}
                  style={styles.modalBtn}
                />
              </View>
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      {/* MODAL: Registrar Venta de Equipo */}
      <Modal visible={sellModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <ThemedText type="subtitle">Vender Equipo</ThemedText>
                {selectedDeviceToSell && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {selectedDeviceToSell.brand} {selectedDeviceToSell.model} (IMEI: {selectedDeviceToSell.imei})
                  </ThemedText>
                )}
              </View>
              <Pressable onPress={() => setSellModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGrid}>
                {selectedDeviceToSell && (
                  <View style={[styles.profitBadge, { backgroundColor: 'rgba(37,99,235,0.08)' }]}>
                    <ThemedText type="small">
                      Costo Adquisición: <ThemedText type="smallBold">{formatCOP(selectedDeviceToSell.purchasePrice)}</ThemedText>
                    </ThemedText>
                    <ThemedText type="smallBold" style={{ color: currentEstimatedProfit > 0 ? '#059669' : theme.textSecondary }}>
                      Utilidad Estimada: +{formatCOP(currentEstimatedProfit)}
                    </ThemedText>
                  </View>
                )}

                <FormInput
                  label="Precio de Venta al Cliente (COP) *"
                  placeholder="Ej: 2300000"
                  value={salePrice}
                  onChangeText={setSalePrice}
                  keyboardType="numeric"
                />

                <FormInput
                  label="Nombre del Comprador *"
                  placeholder="Nombre completo del cliente"
                  value={clientName}
                  onChangeText={setClientName}
                />

                <FormInput
                  label="Cédula / Documento del Comprador"
                  placeholder="Para el comprobante fiscal/garantía"
                  value={clientDocument}
                  onChangeText={setClientDocument}
                  keyboardType="numeric"
                />

                <FormInput
                  label="Teléfono del Comprador"
                  placeholder="Para compartir factura por WhatsApp"
                  value={clientPhone}
                  onChangeText={setClientPhone}
                  keyboardType="phone-pad"
                />

                <FormInput
                  label="Garantía al Cliente (Meses) *"
                  placeholder="Ej: 3"
                  value={clientWarrantyMonths}
                  onChangeText={setClientWarrantyMonths}
                  keyboardType="numeric"
                />

                {/* Método de Pago */}
                <View style={styles.fieldGroup}>
                  <ThemedText type="smallBold" style={styles.fieldLabel}>Método de Pago</ThemedText>
                  <View style={styles.chipsRow}>
                    {PAYMENT_METHODS.map((pm) => (
                      <Pressable
                        key={pm}
                        onPress={() => setPaymentMethod(pm)}
                        style={[
                          styles.chipSmall,
                          {
                            backgroundColor: paymentMethod === pm ? Brand.primary : theme.surfaceContainer,
                            borderColor: paymentMethod === pm ? Brand.primary : theme.border,
                          },
                        ]}>
                        <ThemedText
                          type="small"
                          style={{ color: paymentMethod === pm ? '#ffffff' : theme.textSecondary }}>
                          {pm}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <FormInput
                  label="Observaciones de la Venta"
                  placeholder="Accesorios incluidos, condiciones acordadas..."
                  value={saleNotes}
                  onChangeText={setSaleNotes}
                  multiline
                />
              </View>

              <View style={styles.modalActions}>
                <Button
                  label="Cancelar"
                  variant="secondary"
                  onPress={() => setSellModalVisible(false)}
                  style={styles.modalBtn}
                />
                <Button
                  label={isSubmittingSale ? 'Confirmando...' : 'Confirmar Venta y Generar Factura'}
                  variant="primary"
                  onPress={handleSaveSale}
                  disabled={isSubmittingSale}
                  style={styles.modalBtn}
                />
              </View>
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  buyButton: {
    minWidth: 160,
  },
  metricsRow: {
    flexDirection: 'column',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  metricsRowTablet: {
    flexDirection: 'row',
  },
  metricCard: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: Shape.md,
    gap: Spacing.half,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  searchSection: {
    marginBottom: Spacing.three,
    gap: Spacing.two,
  },
  searchInput: {
    marginBottom: 0,
  },
  filterChips: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  chip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Shape.sm,
    borderWidth: 1,
  },
  emptyContainer: {
    padding: Spacing.five,
    borderRadius: Shape.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  listGrid: {
    gap: Spacing.two,
    paddingBottom: Spacing.five,
  },
  deviceCard: {
    padding: Spacing.three,
    borderRadius: Shape.md,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  statusBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Shape.sm,
  },
  cardDivider: {
    height: 1,
    width: '100%',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  soldSection: {
    backgroundColor: 'rgba(0,0,0,0.02)',
    padding: Spacing.two,
    borderRadius: Shape.sm,
    gap: Spacing.one,
  },
  inStockInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  cardBtn: {
    flex: 1,
  },
  deleteIconButton: {
    padding: Spacing.two,
    borderRadius: Shape.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.three,
  },
  modalContent: {
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
    borderRadius: Shape.lg,
    padding: Spacing.four,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  formGrid: {
    gap: Spacing.two,
  },
  fieldGroup: {
    gap: Spacing.half,
  },
  fieldLabel: {
    fontSize: 12,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  chipSmall: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: Shape.sm,
    borderWidth: 1,
  },
  profitBadge: {
    padding: Spacing.two,
    borderRadius: Shape.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
  modalBtn: {
    flex: 1,
  },
});
