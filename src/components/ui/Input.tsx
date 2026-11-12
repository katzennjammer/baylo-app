import { forwardRef, type ComponentType } from "react";
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";

import { border, dColor, radius, size, space, textStyle, type } from "../../theme/tokens";

export interface InputIconProps {
  size: number;
  color: string;
}

export interface InputProps extends TextInputProps {
  icon?: ComponentType<InputIconProps>;
  containerStyle?: StyleProp<ViewStyle>;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { icon, containerStyle, style, ...inputProps },
  ref,
) {
  const Icon = icon;

  return (
    <View style={[styles.container, containerStyle]}>
      {Icon ? (
        <View style={styles.icon}>
          <Icon size={size.design.inputIcon} color={dColor.inkSecondary} />
        </View>
      ) : null}
      <TextInput
        ref={ref}
        {...inputProps}
        placeholderTextColor={inputProps.placeholderTextColor ?? dColor.inkSecondary}
        style={[styles.input, icon ? styles.inputWithIcon : undefined, style]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    minHeight: size.design.input,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: dColor.searchSurface,
    borderColor: dColor.divider,
    borderWidth: border.d,
    borderRadius: radius.dButton,
    paddingHorizontal: space.design.scale.sm,
  },
  icon: { marginRight: space.design.scale.xs },
  input: {
    flex: 1,
    minHeight: size.design.input,
    paddingVertical: 0,
    color: dColor.ink,
    ...textStyle(type.dBody),
  },
  inputWithIcon: { paddingLeft: 0 },
});
