---
title: "2015 Burning Man - Dreamland"
date: 2015-08-30T12:00:00-07:00
draft: false
cover: "images/dreamland_1_duncan_co.jpg"
---
*A whimsical experience of vivid colors, dazzling light and flames transport participants to the world of spectacle and the carnivalesque.*
![Duncan-1](images/dreamland_1_duncan_co.jpg)
*Photo: [Duncan Rawlinson](https://duncan.co/)* 

<iframe src="https://player.vimeo.com/video/141555457" width="640" height="360" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>
<p>from <a href="https://vimeo.com/user4361503">Flavio Lemelle</a> on <a href="https://vimeo.com">Vimeo</a>.</p>
<iframe width="560" height="315" src="https://www.youtube.com/embed/ZiWITmmOOS8" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

## Involvement
- Electro/Mechanical design
  - In order to pass both electricity and propane through the central spire's hub, I designed a joint consisting of a rotary fluid union and an electrical slip ring. This design allowed for up to: 200cfm of propane and 25A @120VAC.
  - Carousel position was captured by creating a custom rotary encoder that consisted of a square tooth gear with two hall-effect sensors 90deg out of phase with one another. This configuration allowed us to track position(leading to velocity and acceleration) as well as directionality of the rotation.
- Lighting design
  - One of the first design constraints was to mimic the globe bulbs on old time carnival rides. This was accomplished by sourcing WS2812b plastic globe lights from China for the main carousel. Since this piece was intended to be highly interactive, I decided to utilize dome lights for the lamp poles to prevent people accidentally breaking the lights. From there, the bench lights became the simple choice of using WS2811 LED strips.
  - Choosing the WS2812b lights limited the number of controllers I was able to utilize for Dreamland. The light type, plus the shear footprint of the piece lead to the decision to treat each structure (carousel, lamp poles, benches) as a fully self contained unit consisting of a: raspberry pi, [Fadecandy](http://www.misc.name/fadecandy/) controller and power distribution. This architecture allowed each structure to be de-coupled from one another, which increase the testing velocity in Oakland, prevented cascading failures and simplified on-site debugging.
  - Open pixel control was utilized to control the pixels
- Network Architecture
  - [Ubiquiti](https://www.ubnt.com/) equipment was utilized throughout.
  - Ground elements were wired over Ethernet.
  - A point-to-point network consisting of a high powered directional antennae pointing at the upper carousel's omni directional antennae negated the need to develop a electrical slip ring to pass Ethernet packets.
- Flame effects controllers
  - Firing the poofers was accomplished with an off the shelf relay board for makers. Safety was accomplished by connecting the solenoids to the normally closed contacts of the relay, which would only stay open if the controller constantly received the appropriate command from the controller - essentially a digital deadman's switch.
- Software
  - Choosing to place a raspberry pi in each structure lead to a configuration management headache as there were 8 pis and a central control computers. Unfortunately, I wasn't aware of ansible at the time so I developed a python based configuration management system that would ingest a config file, shell out to each node, configure the node and reload the Fadecandy and dreamland supervisors.
  - Lighting patterns were controlled via [LX](https://github.com/heronarts/LX), which is essentially a 3D light synthesizer. All pixels are mapped into a 3D space, which allows the lighting patterns to be decoupled from the physical reality.

## Links
- [Flux Foundation](http://www.fluxfoundation.org/dreamland/)
- [Github](https://github.com/Dreamland2015/Dreamland)

## Special Thanks
- [Caroline Miller](https://www.linkedin.com/in/mills42): For the introduction to Flux
- [Mark Slee](http://mcslee.com): For the late afternoon LX matrix transformation library additions
- [Peter Kimelman](https://experience.pk): For pushing me even when I was falling apart
- [Samson Yeung](https://github.com/fragmede): For the software help, and on-site aloft linux usb driver debugging
