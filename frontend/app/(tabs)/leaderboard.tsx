
import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import { useFocusEffect } from "expo-router";
import { api } from "../../src/api";
import FireEmptyState from "../../src/components/fire/FireEmptyState";
import FireLoading from "../../src/components/fire/FireLoading";
import ArcadeBackground from "../../src/game/ui/ArcadeBackground";
import FirePanel from "../../src/components/fire/FirePanel";
import FireScreenEntrance from "../../src/components/fire/FireScreenEntrance";

type Leader = { rank: number; username: string; score: number; is_you?: boolean; belt?: { name?: string } };

const badgeFor = (rank: number) => rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "⭐";

export default function LeaderboardScreen(){
const isFocused = useIsFocused();
const [leaders, setLeaders] = useState<Leader[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(false);
const load = useCallback(async () => {
  setLoading(true);
  setError(false);
  try {
    const response = await api.leaderboard();
    setLeaders(Array.isArray(response?.leaderboard) ? response.leaderboard : []);
  } catch {
    setError(true);
  } finally {
    setLoading(false);
  }
}, []);
useFocusEffect(useCallback(() => { void load(); }, [load]));

if (loading && !leaders.length) return <SafeAreaView style={styles.container} edges={["top"]}><ArcadeBackground active={isFocused}/><FireLoading title="Loading Rankings" subtitle="Finding the arena leaders." /></SafeAreaView>;
if (error && !leaders.length) return <SafeAreaView style={styles.container} edges={["top"]}><ArcadeBackground active={isFocused}/><FireEmptyState icon="!" title="Rankings Unavailable" message="Check your connection and try again." buttonLabel="RETRY" onPress={() => { void load(); }} /></SafeAreaView>;
if (!leaders.length) return <SafeAreaView style={styles.container} edges={["top"]}><ArcadeBackground active={isFocused}/><FireEmptyState icon="🏆" title="No Rankings Yet" message="Complete a feast to claim the first spot." /></SafeAreaView>;
return(
<SafeAreaView style={styles.container} edges={["top"]}>
<ArcadeBackground active={isFocused}/>
<ScrollView contentContainerStyle={styles.content}>
<FireScreenEntrance distance={12}>
<Text style={styles.header}>🏆 FIRE FEAST RANKINGS</Text>
<Text style={styles.sub}>Compete for the top spot!</Text>

<FirePanel title="ARENA LEADER" elevated accent="gold" style={styles.podium}>
<Text style={styles.crown}>👑</Text>
<Text style={styles.podiumName}>{leaders[0].username}</Text>
<Text style={styles.podiumScore}>{leaders[0].score.toLocaleString()} pts</Text>
</FirePanel>

<Text style={styles.section}>GLOBAL LEADERBOARD</Text>

</FireScreenEntrance>
{leaders.map(player=>(
<FirePanel
key={`${player.rank}-${player.username}`}
style={[
styles.card,
player.is_you && styles.currentPlayer
]}>
<Text style={styles.rank}>{badgeFor(player.rank)} #{player.rank}</Text>

<View style={styles.playerInfo}>
<Text numberOfLines={1} style={styles.name}>{player.username}</Text>
<Text style={styles.level}>🔥 {player.belt?.name ?? "Arena Challenger"}</Text>
</View>

<Text adjustsFontSizeToFit numberOfLines={1} style={styles.score}>
{player.score.toLocaleString()}
</Text>
</FirePanel>
))}
</ScrollView>
</SafeAreaView>
);
}

const styles=StyleSheet.create({
container:{flex:1,backgroundColor:"#070405"},
content:{paddingHorizontal:12,paddingTop:7,paddingBottom:22},
header:{color:"#FFF0D8",fontSize:25,fontWeight:"900",letterSpacing:1.1},
sub:{color:"#A99482",fontSize:10,marginTop:2,marginBottom:10},
podium:{
backgroundColor:"rgba(17,10,10,0.96)",
borderWidth:2,
borderColor:"#F6C76A",
borderRadius:14,
padding:14,
alignItems:"center",
marginBottom:12,
},
crown:{fontSize:44},
podiumName:{color:"#FFF7E8",fontSize:24,fontWeight:"900",letterSpacing:0.3,marginTop:6},
podiumScore:{color:"#F6C76A",fontWeight:"900",marginTop:6,fontSize:18},
section:{color:"#E8BD7A",fontSize:10,fontWeight:"900",letterSpacing:1.1,marginBottom:7},
card:{
backgroundColor:"rgba(14,9,10,0.95)",
borderRadius:11,
padding:12,
marginBottom:6,
flexDirection:"row",
alignItems:"center",
borderWidth:1,
borderColor:"rgba(216,128,38,0.48)",
},
currentPlayer:{
borderColor:"#FF8A00",
borderWidth:2,
},
rank:{color:"#F6C76A",flexShrink:0,fontWeight:"900",width:70},
playerInfo:{flex:1,minWidth:0},
name:{color:"#FFF7E8",fontSize:18,fontWeight:"900",flexShrink:1},
level:{color:"#CDBEAD",marginTop:4},
score:{color:"#F6C76A",flexShrink:1,fontWeight:"900",fontSize:18,marginLeft:8,maxWidth:"32%",minWidth:0,textAlign:"right"},
});
