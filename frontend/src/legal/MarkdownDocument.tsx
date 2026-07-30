import React, { Fragment, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

function parseMarkdown(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
      index += 1;
      continue;
    }

    if (/^-\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length) {
        const item = /^-\s+(.+)$/.exec(lines[index].trim());
        if (!item) break;
        items.push(item[1]);
        index += 1;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length) {
      const candidate = lines[index].trim();
      if (!candidate || /^(#{1,6})\s+/.test(candidate) || /^-\s+/.test(candidate)) break;
      paragraph.push(candidate);
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraph.join("\n") });
  }

  return blocks;
}

function InlineMarkdown({ text }: { text: string }) {
  return <>
    {text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => {
      const bold = part.startsWith("**") && part.endsWith("**");
      return <Text key={`${index}:${part}`} style={bold ? styles.bold : undefined}>{bold ? part.slice(2, -2) : part}</Text>;
    })}
  </>;
}

export default function MarkdownDocument({ markdown, largeText = false }: { markdown: string; largeText?: boolean }) {
  const blocks = useMemo(() => parseMarkdown(markdown), [markdown]);

  return <View>
    {blocks.map((block, index) => {
      if (block.type === "heading") {
        if (block.level === 1) return null;
        return <Text accessibilityRole="header" key={`${index}:${block.text}`} style={[styles.heading, block.level >= 3 && styles.subheading, largeText && styles.largeHeading]}>
          <InlineMarkdown text={block.text} />
        </Text>;
      }
      if (block.type === "list") {
        return <View key={`${index}:list`} style={styles.list}>
          {block.items.map((item, itemIndex) => <View key={`${itemIndex}:${item}`} style={styles.listRow}>
            <Text style={[styles.bullet, largeText && styles.largeBody]}>•</Text>
            <Text style={[styles.body, styles.listText, largeText && styles.largeBody]}><InlineMarkdown text={item} /></Text>
          </View>)}
        </View>;
      }
      return <Text key={`${index}:${block.text}`} style={[styles.body, index === 0 && styles.firstBlock, largeText && styles.largeBody]}>
        <InlineMarkdown text={block.text} />
      </Text>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  body: { color: "#D3BEA8", fontSize: 14, lineHeight: 22, marginBottom: 13 },
  bold: { color: "#FFF0D8", fontWeight: "900" },
  bullet: { color: "#E5AD63", fontSize: 15, fontWeight: "900", lineHeight: 22, width: 16 },
  firstBlock: { marginTop: 0 },
  heading: { color: "#F2C57E", fontSize: 18, fontWeight: "900", lineHeight: 24, marginBottom: 9, marginTop: 15 },
  largeBody: { fontSize: 18, lineHeight: 28 },
  largeHeading: { fontSize: 22, lineHeight: 29 },
  list: { marginBottom: 9 },
  listRow: { alignItems: "flex-start", flexDirection: "row", paddingRight: 4 },
  listText: { flex: 1, marginBottom: 7 },
  subheading: { color: "#E5AD63", fontSize: 15, lineHeight: 21, marginTop: 9 },
});
