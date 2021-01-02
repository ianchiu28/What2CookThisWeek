import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Image, TextInput, Button } from 'react-native';

// const logo = {
//   uri: 'https://reactnative.dev/img/tiny_logo.png',
//   width: 64,
//   height: 64
// };

// export default App = () => (
//   <ScrollView>
//     <Text style={{ fontSize: 96 }}>Scroll me plz</Text>
//     <Image source={logo} />
//     <Image source={logo} />
//     <Image source={logo} />
//     <Image source={logo} />
//     <Image source={logo} />
//     <Text style={{ fontSize: 96 }}>If you like</Text>
//     <Image source={logo} />
//     <Image source={logo} />
//     <Image source={logo} />
//     <Image source={logo} />
//     <Image source={logo} />
//     <Text style={{ fontSize: 96 }}>Scrolling down</Text>
//     <Image source={logo} />
//     <Image source={logo} />
//     <Image source={logo} />
//     <Image source={logo} />
//     <Image source={logo} />
//     <Text style={{ fontSize: 96 }}>What's the best</Text>
//     <Image source={logo} />
//     <Image source={logo} />
//     <Image source={logo} />
//     <Image source={logo} />
//     <Image source={logo} />
//     <Text style={{ fontSize: 96 }}>Framework around?</Text>
//     <Image source={logo} />
//     <Image source={logo} />
//     <Image source={logo} />
//     <Image source={logo} />
//     <Image source={logo} />
//     <Text style={{ fontSize: 96 }}>React Native</Text>
//   </ScrollView>
// )

// const PizzaTransfer = () => {
//   const [text, setText] = useState('');
//   return (
//     <View style={{padding: 10}}>
//       <TextInput
//         style={{height: 40}}
//         placeholder='Type here to translate!'
//         onChangeText={text => setText(text)}
//         defaultValue={text}
//       />
//       <Text style={{padding: 10, fontSize: 42}}>
//         {text.split(' ').map(word => word && '🍕').join(' ')}
//       </Text>
//     </View>
//   );
// };

// const Cat = (props) => {
//   const [isHungry, setIsHungry] = useState(true);

//   return (
//     <View>
//       <Text>I am {props.name}, and I am {isHungry ? 'hungry' : 'full'}!</Text>
//       <Button
//         onPress={() => {
//           setIsHungry(false);
//         }}
//         disabled={!isHungry}
//         title={isHungry ? 'Pour me some milk, please!' : 'Thank you!'}
//       />
//     </View>
//   );
// };

// const getFullName = (firstName, secondName, thirdName) => {
//   return firstName + ' ' + secondName + ' ' + thirdName;
// }

// export default function App() {
//   return (
//     <ScrollView>
//       <Text>Some text</Text>
//       <View>
//         <Text>Some more text</Text>
//         <Image
//           source={{
//             uri: 'https://reactnative.dev/docs/assets/p_cat2.png'
//           }}
//           style={{ width: 200, height: 200 }}
//         />
//       </View>
//       <TextInput
//         style={{
//           height: 40,
//           borderColor: 'gray',
//           borderWidth: 1
//         }}
//         defaultValue='You can type in me'
//       />
//       <Text>Hello, I am {getFullName('Rum', 'Tum', 'Tugger')}</Text>
//       <View>
//         <Text>Hello, I am...</Text>
//         <TextInput
//           style={{
//             height: 40,
//             borderColor: 'gray',
//             borderWidth: 1
//           }}
//           defaultValue='Name me!'
//         />
//       </View>
//       <Cat name='Maru' />
//       <Cat name='Spot' />
//       <PizzaTransfer />
//     </ScrollView>
//     // <View style={styles.container}>
//     //   <Text>Open up App.js to start working on your app!</Text>
//     //   <Text>Try Edit me!</Text>
//     //   <StatusBar style="auto" />
//     // </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#fff',
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
// });
