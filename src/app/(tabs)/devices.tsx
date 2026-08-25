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

type DeviceTabSection = 'compra' | 'venta' | 'utilidad';

const CONDITIONS: DeviceCondition[] = [
  'Nuevo',
  'Usado - Excelente',
  'Usado - Bueno',
  'Para Repuestos',
];

const PAYMENT_METHODS: DevicePaymentMethod[] = ['Efectivo', 'Transferencia', 'Tarjeta'];

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

  // Pestaña activa: Compra | Venta | Utilidad e Inventario
  const [activeTab, setActiveTab] = useState<DeviceTabSection>('compra');

  // Filtros de búsqueda por pestaña
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<DeviceStatus | 'Todos'>('Todos');

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

  // Equipos en Stock
  const inStockDevices = useMemo(
    () => devices.filter((d) => d.status === 'En Stock'),
    [devices]
  );

  // Equipos Vendidos
  const soldDevices = useMemo(
    () => devices.filter((d) => d.status === 'Vendido'),
    [devices]
  );

  // Filtrado para la pestaña de Utilidad e Inventario
  const inventoryFiltered = useMemo(
    () => filterDevices(devices, searchQuery, statusFilter),
    [devices, searchQuery, statusFilter]
  );

  // Filtrado para la pestaña de Compra (historial de compras)
  const buyFiltered = useMemo(
    () => filterDevices(devices, searchQuery, 'Todos'),
    [devices, searchQuery]
  );

  // Filtrado para la pestaña de Venta
  const saleFiltered = useMemo(
    () => filterDevices(inStockDevices, searchQuery, 'En Stock'),
    [inStockDevices, searchQuery]
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
        notify('¡Equipo registrado exitosamente en el stock!');
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
        notify('¡Venta realizada con éxito! Ya puedes ver o compartir la factura.');
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
      {/* Encabezado */}
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          Módulo de Equipos
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Gestión integral de compra, venta, inventario y utilidades por celular
        </ThemedText>
      </View>

      {/* Selector Segmentado de Módulos (3 Opciones Principales) */}
      <View style={styles.segmentNav}>
        <Pressable
          onPress={() => {
            setActiveTab('compra');
            setSearchQuery('');
          }}
          style={[
            styles.segmentBtn,
            activeTab === 'compra'
              ? { backgroundColor: Brand.primary }
              : { backgroundColor: theme.surfaceContainer },
          ]}>
          <Ionicons
            name="cart-outline"
            size={18}
            color={activeTab === 'compra' ? Brand.onBrand : theme.textSecondary}
          />
          <ThemedText
            type="smallBold"
            style={{
              color: activeTab === 'compra' ? Brand.onBrand : theme.textSecondary,
            }}>
            1. Compra de Equipos
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={() => {
            setActiveTab('venta');
            setSearchQuery('');
          }}
          style={[
            styles.segmentBtn,
            activeTab === 'venta'
              ? { backgroundColor: Brand.primary }
              : { backgroundColor: theme.surfaceContainer },
          ]}>
          <Ionicons
            name="cash-outline"
            size={18}
            color={activeTab === 'venta' ? Brand.onBrand : theme.textSecondary}
          />
          <ThemedText
            type="smallBold"
            style={{
              color: activeTab === 'venta' ? Brand.onBrand : theme.textSecondary,
            }}>
            2. Venta de Equipos
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={() => {
            setActiveTab('utilidad');
            setSearchQuery('');
          }}
          style={[
            styles.segmentBtn,
            activeTab === 'utilidad'
              ? { backgroundColor: Brand.primary }
              : { backgroundColor: theme.surfaceContainer },
          ]}>
          <Ionicons
            name="stats-chart-outline"
            size={18}
            color={activeTab === 'utilidad' ? Brand.onBrand : theme.textSecondary}
          />
          <ThemedText
            type="smallBold"
            style={{
              color: activeTab === 'utilidad' ? Brand.onBrand : theme.textSecondary,
            }}>
            3. Utilidad e Inventario
          </ThemedText>
        </Pressable>
      </View>

      {/* ========================================================================= */}
      {/* 1. MÓDULO DE COMPRA */}
      {/* ========================================================================= */}
      {activeTab === 'compra' && (
        <View style={[styles.mainRow, isDesktop && styles.mainRowDesktop]}>
          {/* Formulario de Compra a Distribuidores */}
          {isAdmin ? (
            <ThemedView
              type="backgroundElement"
              style={[styles.formCard, isDesktop && styles.formCardDesktop]}>
              <ThemedText type="subtitle" style={styles.formTitle}>
                📦 Registrar Nueva Compra
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Ingresa los datos del equipo adquirido a tu proveedor o distribuidor
              </ThemedText>

              <View style={styles.formGrid}>
                <View style={styles.formRow}>
                  <View style={styles.formCol}>
                    <FormInput
                      label="Marca *"
                      placeholder="Ej. Apple, Samsung"
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
                  label="IMEI / Número de Serie *"
                  placeholder="Número de IMEI del equipo"
                  value={imei}
                  onChangeText={setImei}
                  keyboardType="numeric"
                />

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
                  placeholder="Nombre de la persona o distribuidor"
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
                  label="Notas u Observaciones (Opcional)"
                  placeholder="Batería al 85%, rayón leve..."
                  value={purchaseNotes}
                  onChangeText={setPurchaseNotes}
                />

                <Button
                  label={isSubmittingBuy ? 'Registrando...' : '+ Guardar y Añadir al Stock'}
                  variant="primary"
                  onPress={handleAddDevice}
                  disabled={isSubmittingBuy}
                  style={styles.addBtn}
                />
              </View>
            </ThemedView>
          ) : null}

          {/* Historial de Compras */}
          <View style={[styles.listColumn, isDesktop && styles.listColumnDesktop]}>
            <ThemedText type="subtitle">Historial de Compras Registradas</ThemedText>
            <FormInput
              label="Buscar compra"
              placeholder="Buscar por IMEI, modelo o distribuidor..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
            />

            <View style={styles.devicesList}>
              {buyFiltered.length === 0 ? (
                <ThemedView type="backgroundElement" style={styles.emptyContainer}>
                  <Ionicons name="cart-outline" size={48} color={theme.textSecondary} />
                  <ThemedText type="subtitle" style={styles.centerText}>
                    No hay compras registradas
                  </ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.centerText}>
                    Registra tu primera compra con el formulario de la izquierda.
                  </ThemedText>
                </ThemedView>
              ) : (
                buyFiltered.map((device) => (
                  <ThemedView key={device.id} type="backgroundElement" style={styles.deviceCard}>
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
                            backgroundColor:
                              device.status === 'Vendido' ? 'rgba(37,99,235,0.1)' : 'rgba(5,150,105,0.1)',
                            borderColor: device.status === 'Vendido' ? '#2563eb' : '#059669',
                          },
                        ]}>
                        <ThemedText
                          type="smallBold"
                          style={{ color: device.status === 'Vendido' ? '#2563eb' : '#059669' }}>
                          {device.status}
                        </ThemedText>
                      </View>
                    </View>

                    <View style={[styles.cardDivider, { backgroundColor: theme.border }]} />

                    <View style={styles.metaRow}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Distribuidor: <ThemedText type="smallBold">{device.distributor}</ThemedText>
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Costo: <ThemedText type="smallBold">{formatCOP(device.purchasePrice)}</ThemedText>
                      </ThemedText>
                    </View>

                    <View style={styles.metaRow}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Garantía Proveedor: {device.supplierWarrantyMonths} meses
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Fecha: {device.createdAt.split('T')[0]}
                      </ThemedText>
                    </View>

                    {device.purchaseNotes ? (
                      <ThemedText type="small" themeColor="textSecondary" style={{ fontStyle: 'italic' }}>
                        Nota: {device.purchaseNotes}
                      </ThemedText>
                    ) : null}
                  </ThemedView>
                ))
              )}
            </View>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* 2. MÓDULO DE VENTA */}
      {/* ========================================================================= */}
      {activeTab === 'venta' && (
        <View style={styles.fullColumn}>
          <ThemedText type="subtitle">
            Equipos Disponibles para Vender ({inStockDevices.length})
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Selecciona un equipo de tu stock para registrar la venta y emitir la factura con garantía
          </ThemedText>

          <FormInput
            label="Buscar equipo disponible"
            placeholder="Buscar por IMEI, modelo, capacidad..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />

          <View style={styles.devicesList}>
            {saleFiltered.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.emptyContainer}>
                <Ionicons name="checkmark-done-circle-outline" size={48} color="#059669" />
                <ThemedText type="subtitle" style={styles.centerText}>
                  No hay equipos disponibles en stock
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.centerText}>
                  Ve al módulo "1. Compra de Equipos" para registrar nuevas unidades.
                </ThemedText>
              </ThemedView>
            ) : (
              saleFiltered.map((device) => {
                const isSelling = sellingDeviceId === device.id;
                const liveProfit = salePrice
                  ? calculateDeviceProfit(parseCOPInput(salePrice) ?? parseFloat(salePrice), device.purchasePrice)
                  : 0;

                return (
                  <ThemedView key={device.id} type="backgroundElement" style={styles.deviceCard}>
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
                          { backgroundColor: 'rgba(5,150,105,0.1)', borderColor: '#059669' },
                        ]}>
                        <ThemedText type="smallBold" style={{ color: '#059669' }}>
                          ✓ En Stock
                        </ThemedText>
                      </View>
                    </View>

                    <View style={[styles.cardDivider, { backgroundColor: theme.border }]} />

                    <View style={styles.metaRow}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Costo Compra: <ThemedText type="smallBold">{formatCOP(device.purchasePrice)}</ThemedText>
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Garantía Prov: {device.supplierWarrantyMonths} meses
                      </ThemedText>
                    </View>

                    {/* Formulario Inline de Venta */}
                    {isSelling && (
                      <View
                        style={[
                          styles.inlineSellBox,
                          { borderColor: theme.border, backgroundColor: theme.surfaceContainer },
                        ]}>
                        <ThemedText type="smallBold" style={{ color: Brand.primary }}>
                          Datos de Facturación y Venta
                        </ThemedText>

                        <View style={styles.sellProfitBadge}>
                          <ThemedText type="small">
                            Costo Base: {formatCOP(device.purchasePrice)}
                          </ThemedText>
                          <ThemedText
                            type="smallBold"
                            style={{ color: liveProfit > 0 ? '#059669' : theme.textSecondary }}>
                            Utilidad Estimada: +{formatCOP(liveProfit)}
                          </ThemedText>
                        </View>

                        <FormInput
                          label="Precio de Venta al Cliente (COP) *"
                          placeholder="Ej. 2450000"
                          keyboardType="numeric"
                          value={salePrice}
                          onChangeText={setSalePrice}
                        />

                        <FormInput
                          label="Nombre del Cliente *"
                          placeholder="Nombre del comprador"
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
                            label={isSubmittingSale ? 'Confirmando...' : 'Confirmar Venta y Generar Factura'}
                            variant="success"
                            onPress={() => void handleConfirmSale(device)}
                            disabled={isSubmittingSale}
                            style={{ flex: 2 }}
                          />
                        </View>
                      </View>
                    )}

                    {/* Botón de Vender */}
                    <View style={styles.cardActions}>
                      <Button
                        label={isSelling ? 'Cerrar Formulario' : '💵 Vender este Equipo'}
                        variant={isSelling ? 'secondary' : 'primary'}
                        onPress={() => handleOpenSell(device)}
                        style={{ flex: 1 }}
                      />
                    </View>
                  </ThemedView>
                );
              })
            )}
          </View>

          {/* Historial de Ventas Realizadas */}
          <View style={{ marginTop: Spacing.four }}>
            <ThemedText type="subtitle">Historial de Ventas Realizadas ({soldDevices.length})</ThemedText>
            <View style={styles.devicesList}>
              {soldDevices.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary" style={{ fontStyle: 'italic' }}>
                  Aún no se han completado ventas de equipos.
                </ThemedText>
              ) : (
                soldDevices.map((device) => {
                  const profit = calculateDeviceProfit(device.salePrice, device.purchasePrice);
                  const warrantyActive = isDeviceWarrantyActive(device.clientWarrantyExpiry);

                  return (
                    <ThemedView key={device.id} type="backgroundElement" style={styles.deviceCard}>
                      <View style={styles.deviceHeader}>
                        <View style={styles.deviceTitleBlock}>
                          <ThemedText type="subtitle">
                            {formatDeviceName(device.brand, device.model, device.storageCapacity, device.color)}
                          </ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            IMEI: <ThemedText type="smallBold">{device.imei}</ThemedText> • Folio: {device.invoiceFolio}
                          </ThemedText>
                        </View>
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: 'rgba(37,99,235,0.1)', borderColor: '#2563eb' },
                          ]}>
                          <ThemedText type="smallBold" style={{ color: '#2563eb' }}>
                            Vendido
                          </ThemedText>
                        </View>
                      </View>

                      <View style={[styles.soldCard, { backgroundColor: theme.surfaceContainer }]}>
                        <View style={styles.metaRow}>
                          <ThemedText type="small">
                            Comprador: <ThemedText type="smallBold">{device.clientName}</ThemedText>
                          </ThemedText>
                          <ThemedText type="smallBold" style={{ color: '#059669' }}>
                            Vendido en: {formatCOP(device.salePrice || 0)}
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
                        <View style={styles.metaRow}>
                          <ThemedText type="small" themeColor="textSecondary">
                            Costo Base: {formatCOP(device.purchasePrice)}
                          </ThemedText>
                          <ThemedText type="smallBold" style={{ color: '#2563eb' }}>
                            Utilidad: +{formatCOP(profit)}
                          </ThemedText>
                        </View>
                      </View>

                      <View style={styles.cardActions}>
                        <Button
                          label="📄 Ver Factura / Compartir WhatsApp"
                          variant="primary"
                          onPress={() =>
                            router.push({
                              pathname: '/device-receipt/[id]',
                              params: { id: device.id },
                            })
                          }
                          style={{ flex: 1 }}
                        />
                      </View>
                    </ThemedView>
                  );
                })
              )}
            </View>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* 3. MÓDULO DE UTILIDAD E INVENTARIO */}
      {/* ========================================================================= */}
      {activeTab === 'utilidad' && (
        <View style={styles.fullColumn}>
          {/* Tarjetas KPI de Resumen General */}
          <View style={styles.kpiGrid}>
            <GlassCard
              accent={KpiAccent.progress}
              style={[styles.kpiCard, { flexBasis: kpiCardBasis }]}>
              <View style={styles.kpiHeader}>
                <Ionicons name="phone-portrait-outline" size={20} color={Brand.primary} />
                <ThemedText type="small" themeColor="textSecondary">
                  Celulares en Stock
                </ThemedText>
              </View>
              <ThemedText type="title" style={styles.kpiNumberPrimary}>
                {metrics.totalInStock}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Capital Invertido: {formatCOP(metrics.totalInvestedStock)}
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
                Facturación: {formatCOP(metrics.totalRevenueSold)}
              </ThemedText>
            </GlassCard>

            <GlassCard
              accent={KpiAccent.ready}
              style={[styles.kpiCard, { flexBasis: kpiCardBasis }]}>
              <View style={styles.kpiHeader}>
                <Ionicons name="trending-up-outline" size={20} color="#2563eb" />
                <ThemedText type="small" themeColor="textSecondary">
                  Utilidad Neta Total
                </ThemedText>
              </View>
              <ThemedText type="title" style={styles.kpiNumberBlue}>
                {formatCOP(metrics.totalProfit)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Ganancia Neta por Reventa
              </ThemedText>
            </GlassCard>
          </View>

          {/* Inventario Consolidado */}
          <ThemedText type="subtitle" style={{ marginTop: Spacing.two }}>
            Inventario Completo y Balances por Dispositivo
          </ThemedText>

          <FormInput
            label="Buscar en inventario"
            placeholder="Buscar por IMEI, modelo, distribuidor, cliente o folio..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />

          {/* Filtros de Estado */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersScroll}>
            {(['Todos', 'En Stock', 'Vendido'] as const).map((filter) => {
              const isSelected = statusFilter === filter;
              return (
                <Pressable
                  key={filter}
                  onPress={() => setStatusFilter(filter)}
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

          {/* Lista de Inventario */}
          <View style={styles.devicesList}>
            {inventoryFiltered.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.emptyContainer}>
                <Ionicons name="cube-outline" size={48} color={theme.textSecondary} />
                <ThemedText type="subtitle" style={styles.centerText}>
                  No hay registros coincidentes
                </ThemedText>
              </ThemedView>
            ) : (
              inventoryFiltered.map((device) => {
                const isSold = device.status === 'Vendido';
                const profit = isSold
                  ? calculateDeviceProfit(device.salePrice, device.purchasePrice)
                  : 0;

                return (
                  <ThemedView key={device.id} type="backgroundElement" style={styles.deviceCard}>
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

                    <View style={styles.metaRow}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Costo Compra: <ThemedText type="smallBold">{formatCOP(device.purchasePrice)}</ThemedText>
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Distribuidor: {device.distributor}
                      </ThemedText>
                    </View>

                    {isSold ? (
                      <View style={[styles.soldCard, { backgroundColor: theme.surfaceContainer }]}>
                        <View style={styles.metaRow}>
                          <ThemedText type="small">
                            Precio Venta: <ThemedText type="smallBold">{formatCOP(device.salePrice || 0)}</ThemedText>
                          </ThemedText>
                          <ThemedText type="smallBold" style={{ color: '#059669' }}>
                            Utilidad: +{formatCOP(profit)}
                          </ThemedText>
                        </View>
                        <View style={styles.metaRow}>
                          <ThemedText type="small" themeColor="textSecondary">
                            Cliente: {device.clientName} (Doc: {device.clientDocument || 'N/A'})
                          </ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            Garantía: {device.clientWarrantyExpiry}
                          </ThemedText>
                        </View>
                      </View>
                    ) : (
                      <ThemedText type="small" style={{ color: '#059669', fontWeight: '600' }}>
                        ✓ Disponible en bodega
                      </ThemedText>
                    )}

                    <View style={styles.cardActions}>
                      {isSold ? (
                        <Button
                          label="📄 Ver Factura"
                          variant="secondary"
                          onPress={() =>
                            router.push({
                              pathname: '/device-receipt/[id]',
                              params: { id: device.id },
                            })
                          }
                          style={{ flex: 1 }}
                        />
                      ) : (
                        <Button
                          label="Ir a Vender"
                          variant="primary"
                          onPress={() => {
                            setActiveTab('venta');
                            handleOpenSell(device);
                          }}
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
      )}
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
  segmentNav: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  segmentBtn: {
    flexGrow: 1,
    flexShrink: 0,
    minWidth: 160,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Shape.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  fullColumn: {
    width: '100%',
    gap: Spacing.three,
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
