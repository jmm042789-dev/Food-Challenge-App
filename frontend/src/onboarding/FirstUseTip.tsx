import React, { memo, useCallback, useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import FireButton from "../components/fire/FireButton";
import FirePanel from "../components/fire/FirePanel";
import { storage } from "../utils/storage";

const PREFIX = "fire_feast_first_use_tip_v1:";
function FirstUseTip({ tipKey, title, children }: { tipKey: "gear" | "pvp"; title: string; children: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { let mounted = true; void storage.getItem(`${PREFIX}${tipKey}`, "" as string).then((value) => { if (mounted) setVisible(value !== "done"); }); return () => { mounted = false; }; }, [tipKey]);
  const dismiss = useCallback(() => { setVisible(false); void storage.setItem(`${PREFIX}${tipKey}`, "done"); }, [tipKey]);
  if (!visible) return null;
  return <FirePanel compact title={title}><Text style={styles.copy}>{children}</Text><FireButton accessibilityLabel={`Dismiss ${title}`} title="GOT IT" size="compact" variant="secondary" onPress={dismiss} /></FirePanel>;
}
export default memo(FirstUseTip);
const styles = StyleSheet.create({ copy: { color: "#CDB9A4", fontSize: 11, lineHeight: 16, marginBottom: 8 } });
