
import React from "react";
import { Animated, View, Text, StyleSheet, Image } from "react-native";
import { ArenaMeter } from "../../components/animations";
import { usePulse } from "../../animations";

type Props={
  name?:string;
  level:number;
  score:number;
  combo:number;
  coins?:number;
};

const AVATAR=require("../../assets/characters/blaze.png");

export default function PlayerCard({
  name="You",
  level,
  score,
  combo,
  coins=0,
}:Props){
  const comboPulse = usePulse({ enabled: combo > 0, min: 0.94, max: 1.04, duration: 900 });

  return(
    <View style={styles.card}>
      <Image source={AVATAR} resizeMode="contain" style={styles.avatar}/>
      <View style={styles.info}>
        <Text style={styles.name}>👤 {name}</Text>
        <Text style={styles.level}>LEVEL {level}</Text>
        <ArenaMeter active={combo >= 5} style={styles.comboWrap}>
          <Animated.Text style={[styles.combo, { transform: [{ scale: comboPulse.pulse }] }]}>🔥 x{combo} COMBO</Animated.Text>
        </ArenaMeter>
      </View>
      <View style={styles.right}>
        <Text style={styles.label}>SCORE</Text>
        <Text style={styles.score}>{score}</Text>
        <Text style={styles.coins}>🪙 {coins}</Text>
      </View>
    </View>
  );
}

const styles=StyleSheet.create({
card:{
 flexDirection:"row",
 alignItems:"center",
 width:"100%",
 padding:12,
 borderRadius:18,
 borderWidth:2,
 borderColor:"#FFD54A",
 backgroundColor:"rgba(15,17,21,0.92)",
},
avatar:{
 width:64,
 height:64,
 marginRight:12,
},
info:{flex:1},
name:{
 color:"#FFFFFF",
 fontSize:20,
 fontWeight:"900",
},
level:{
 color:"#FFD54A",
 fontWeight:"800",
 marginTop:4,
},
comboWrap:{
 alignSelf:"flex-start",
 marginTop:6,
},
combo:{
 color:"#FF8A00",
 fontWeight:"900",
},
right:{
 alignItems:"center",
 minWidth:78,
},
label:{
 color:"#FFD54A",
 fontSize:12,
 fontWeight:"800",
},
score:{
 color:"#FFFFFF",
 fontSize:28,
 fontWeight:"900",
},
coins:{
 color:"#FFD54A",
 fontWeight:"800",
 marginTop:4,
}
});
