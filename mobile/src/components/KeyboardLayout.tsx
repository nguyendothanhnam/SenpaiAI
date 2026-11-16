import { createContext, forwardRef, useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentRef, type PropsWithChildren, type Ref } from 'react'
import { Dimensions, FlatList, Keyboard, Platform, ScrollView, StyleSheet, TextInput, View, useWindowDimensions, type FlatListProps, type KeyboardEvent, type ScrollViewProps, type TextInputProps, type ViewProps } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { focusedScrollDelta, keyboardOverlap, remainingBottomInset, remainingSideInsets, type Frame, type KeyboardFrame } from '../features/keyboard/geometry'

type NativeScroll = ComponentRef<typeof ScrollView>
type NativeInput = ComponentRef<typeof TextInput>
type Scroller = (input: NativeInput) => void
function revealInput(input: NativeInput, viewport: NativeScroll | null | undefined, scrollBy: (delta: number) => void) {
  if (!viewport) return
  input.measureInWindow((_x, y, _width, height) => viewport.measureInWindow((_sx, sy, _sw, sh) => {
    if (height > 0 && sh > 0) {
      const delta = focusedScrollDelta({ y, height }, { y: sy, height: sh })
      if (Math.abs(delta) > 1) scrollBy(delta)
    }
  }))
}
interface KeyboardLayoutState {
  visible: boolean
  availableHeight: number
  bottomInset: number
  registerScroller: (scroller: Scroller | null) => () => void
  focus: (input: NativeInput | null) => void
  blur: (input: NativeInput | null) => void
  ensureVisible: () => void
}
const Context = createContext<KeyboardLayoutState | null>(null)
export function useKeyboardLayout() {
  const context = useContext(Context)
  if (!context) throw new Error('KeyboardLayout is missing')
  return context
}
function setRef<T>(ref: Ref<T> | undefined, value: T | null) { if (typeof ref === 'function') ref(value); else if (ref) ref.current = value }

/** Native-only viewport avoidance, shared by lists, forms and modal dialogs.
 * Measure the OUTER view: padding its child cannot alter this measurement.
 * If Android already resized the window, overlap becomes zero automatically.
 */
export function KeyboardLayout({ children, style, onLayout, onKeyboardLayout, safeTop = false, ...props }: PropsWithChildren<ViewProps & { safeTop?: boolean; onKeyboardLayout?: (state: { visible: boolean; availableHeight: number }) => void }>) {
  const root = useRef<ComponentRef<typeof View>>(null), scroller = useRef<Scroller | null>(null), input = useRef<NativeInput | null>(null)
  const window = useWindowDimensions(), insets = useSafeAreaInsets()
  const [frame, setFrame] = useState<Frame>({ x: 0, y: 0, width: 0, height: 0 })
  const [keyboard, setKeyboard] = useState<KeyboardFrame | undefined>(() => Keyboard.metrics() ?? undefined)
  const measure = useCallback(() => root.current?.measureInWindow((x, y, width, height) => {
    setFrame(previous => previous.x === x && previous.y === y && previous.width === width && previous.height === height ? previous : { x, y, width, height })
  }), [])
  const raf = useRef<number | null>(null)
  const ensureVisible = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      raf.current = null
      if (input.current && scroller.current) scroller.current(input.current)
    })
  }, [])
  useEffect(() => {
    const update = (event: KeyboardEvent) => {
      if (Platform.OS === 'ios') Keyboard.scheduleLayoutAnimation(event)
      setKeyboard(event.endCoordinates.height > 0 && event.endCoordinates.screenY < Dimensions.get('screen').height ? event.endCoordinates : undefined)
      measure(); ensureVisible()
    }
    const hide = (event: KeyboardEvent) => {
      if (Platform.OS === 'ios') Keyboard.scheduleLayoutAnimation(event)
      setKeyboard(undefined); measure()
    }
    const subscriptions = Platform.OS === 'ios'
      ? [Keyboard.addListener('keyboardWillShow', update), Keyboard.addListener('keyboardWillChangeFrame', update), Keyboard.addListener('keyboardDidChangeFrame', update), Keyboard.addListener('keyboardWillHide', hide), Keyboard.addListener('keyboardDidHide', hide)]
      : [Keyboard.addListener('keyboardDidShow', update), Keyboard.addListener('keyboardDidHide', hide)]
    return () => { subscriptions.forEach(subscription => subscription.remove()); if (raf.current !== null) cancelAnimationFrame(raf.current) }
  }, [measure, ensureVisible])
  useEffect(() => { measure() }, [measure, window.width, window.height, insets.top, insets.bottom, insets.left, insets.right])
  const visible = !!keyboard && keyboard.height > 0
  const overlap = keyboardOverlap(frame, visible ? keyboard : undefined)
  const bottomInset = remainingBottomInset(frame, window.height, insets.bottom, visible)
  const sides = remainingSideInsets(frame.width ? frame : { ...frame, width: window.width }, window.width, insets.left, insets.right)
  const availableHeight = Math.max(0, (frame.height || window.height) - overlap - bottomInset)
  const registerScroller = useCallback((value: Scroller | null) => { scroller.current = value; return () => { if (scroller.current === value) scroller.current = null } }, [])
  const focus = useCallback((value: NativeInput | null) => { input.current = value; ensureVisible() }, [ensureVisible])
  const blur = useCallback((value: NativeInput | null) => { if (input.current === value) input.current = null }, [])
  const context = useMemo(() => ({ visible, availableHeight, bottomInset, registerScroller, focus, blur, ensureVisible }), [visible, availableHeight, bottomInset, registerScroller, focus, blur, ensureVisible])
  const notify = useRef(onKeyboardLayout)
  notify.current = onKeyboardLayout
  useEffect(() => {
    if (visible) ensureVisible()
    const task = requestAnimationFrame(() => notify.current?.({ visible, availableHeight }))
    return () => cancelAnimationFrame(task)
  }, [visible, availableHeight, ensureVisible])
  return <View {...props} ref={root} collapsable={false} style={[{ flex: 1, minHeight: 0 }, style]} onLayout={event => { measure(); onLayout?.(event) }} onStartShouldSetResponder={event => event.target === event.currentTarget} onResponderRelease={Keyboard.dismiss}>
    <View style={{ flex: 1, minHeight: 0, paddingBottom: overlap, paddingTop: safeTop ? Math.max(0, insets.top - frame.y) : 0, paddingLeft: sides.left, paddingRight: sides.right }}>
      <Context.Provider value={context}>{children}</Context.Provider>
    </View>
  </View>
}

/** The viewport owns keyboard padding. Disable native automatic keyboard insets
 * so iOS cannot apply the same keyboard height a second time. */
export const KeyboardScrollView = forwardRef<NativeScroll, ScrollViewProps>(function KeyboardScrollView({ onScrollBeginDrag, onScroll, contentContainerStyle, ...props }, forwardedRef) {
  const ref = useRef<NativeScroll>(null), offset = useRef(0), { registerScroller, bottomInset } = useKeyboardLayout()
  useEffect(() => registerScroller(input => revealInput(input, ref.current?.getNativeScrollRef(), delta => {
    offset.current = Math.max(0, offset.current + delta)
    ref.current?.scrollTo({ y: offset.current, animated: false })
  })), [registerScroller])
  const flat = StyleSheet.flatten(contentContainerStyle)
  return <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustContentInsets={false} automaticallyAdjustKeyboardInsets={false} contentInsetAdjustmentBehavior="never" scrollEventThrottle={16} {...props} contentContainerStyle={[contentContainerStyle, { paddingBottom: Number(flat?.paddingBottom ?? flat?.paddingVertical ?? flat?.padding ?? 0) + bottomInset }]} ref={value => { ref.current = value; setRef(forwardedRef, value) }} onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; onScroll?.(event) }} onScrollBeginDrag={event => { Keyboard.dismiss(); onScrollBeginDrag?.(event) }} />
})
export function KeyboardFlatList<T>({ ref: forwardedRef, onScrollBeginDrag, onScroll, contentContainerStyle, includeBottomInset = true, ...props }: FlatListProps<T> & { ref?: Ref<FlatList<T>>; includeBottomInset?: boolean }) {
  const ref = useRef<FlatList<T>>(null), offset = useRef(0), { registerScroller, bottomInset } = useKeyboardLayout()
  const inverted = !!props.inverted
  useEffect(() => registerScroller(input => revealInput(input, ref.current?.getNativeScrollRef(), delta => {
    offset.current = Math.max(0, offset.current + (inverted ? -delta : delta))
    ref.current?.scrollToOffset({ offset: offset.current, animated: false })
  })), [registerScroller, inverted])
  const flat = StyleSheet.flatten(contentContainerStyle)
  return <FlatList keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustContentInsets={false} automaticallyAdjustKeyboardInsets={false} contentInsetAdjustmentBehavior="never" scrollEventThrottle={16} {...props} contentContainerStyle={[contentContainerStyle, { paddingBottom: Number(flat?.paddingBottom ?? flat?.paddingVertical ?? flat?.padding ?? 0) + (includeBottomInset ? bottomInset : 0) }]} ref={value => { ref.current = value; setRef(forwardedRef, value) }} onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; onScroll?.(event) }} onScrollBeginDrag={event => { Keyboard.dismiss(); onScrollBeginDrag?.(event) }} />
}
export const KeyboardInput = forwardRef<NativeInput, TextInputProps & { ensureVisible?: boolean }>(function KeyboardInput({ ensureVisible = true, onFocus, onBlur, onContentSizeChange, onSelectionChange, style, ...props }, forwardedRef) {
  const ref = useRef<NativeInput>(null), layout = useKeyboardLayout()
  const { blur, focus } = layout
  const assignRef = useCallback((value: NativeInput | null) => {
    if (!value) blur(ref.current)
    ref.current = value; setRef(forwardedRef, value)
    if (ensureVisible && value?.isFocused()) focus(value)
  }, [blur, focus, forwardedRef, ensureVisible])
  const flat = StyleSheet.flatten(style)
  const maximum = Math.min(Number(flat?.maxHeight ?? Infinity), Math.max(48, Math.floor(layout.availableHeight * 0.5)))
  const multilineStyle = props.multiline && ensureVisible ? { minHeight: Math.min(Number(flat?.minHeight ?? 48), maximum), maxHeight: maximum } : undefined
  return <TextInput {...props} style={[style, multilineStyle]} ref={assignRef} onFocus={event => { if (ensureVisible) layout.focus(ref.current); onFocus?.(event) }} onBlur={event => { layout.blur(ref.current); onBlur?.(event) }} onContentSizeChange={event => { onContentSizeChange?.(event); if (ensureVisible && ref.current?.isFocused()) layout.ensureVisible() }} onSelectionChange={event => { onSelectionChange?.(event); if (ensureVisible && ref.current?.isFocused()) layout.ensureVisible() }} />
})
