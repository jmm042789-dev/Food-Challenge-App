
import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";

type Props = {
  name?: string;
  score: number;
  rank?: string;
  difficulty?: string;
};

const AVATAR = require("../../assets/characters/blaze.png");

export default function OpponentCard({
  name="Blaze",
  score,
  rank="Bronze",
  difficulty="Normal",
}:Props){
  return(
    <View style={styles.card}>
      <Image source={AVATAR} style={styles.avatar} resizeMode="contain"/>
      <View style={styles.info}>
        <Text style={styles.name}>🔥 {name}</Text>
        <Text style={styles.meta}>{rank} • {difficulty}</Text>
      </View>
      <View style={styles.scoreBox}>
        <Text style={styles.scoreLabel}>SCORE</Text>
        <Text style={styles.score}>{score}</Text>
      </View>
    </View>
  );
}

const styles=StyleSheet.create({
card:{
 flexDirection:"row",
 alignItems:"center",
 backgroundColor:"rgba(15,17,21,0.92)",
 borderRadius:18,
 borderWidth:2,
 borderColor:"#FF8A00",
 padding:12,
 width:"100%",
},
avatar:{
 width:64,
 height:64,
 marginRight:12,
},
info:{
 flex:1,
},
name:{
 color:"#FFD54A",
 fontSize:20,
 fontWeight:"900",
},
meta:{
 color:"#D0D0D0",
 marginTop:4,
 fontSize:13,
 fontWeight:"700",
},
scoreBox:{
 alignItems:"center",
 minWidth:72,
},
scoreLabel:{
 color:"#FF8A00",
 fontWeight:"800",
 fontSize:12,
},
score:{
 color:"#FFF",
 fontSize:28,
 fontWeight:"900",
}
});
