---
title: "2016 Burning Man - Black Rock Lighthouse Service"
date: 2016-08-30T12:00:00-07:00
draft: false
cover: "images/brls_1.jpg"
---

![](images/brls_1.jpg)

<iframe width="560" height="315" src="https://www.youtube.com/embed/hLChQsBYCa8" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

## Involvement
- Budgeting
  - Short and sweet: Lighting/Electrical budget was stated for $13k, due to the proliferation of Alibaba and using standardized electrical products, the final budget came in right around $7k.
- Lighting design lead
  - Preliminary ideas required four main rotating lights, with sconces around the exterior of the structures to illuminate the outside.
  - For the main light a discontinued 'Space Cannon II' DMX controlled spotlight was donated to the project from someone in the community. Due to the simplicity of DMX, all features of the light were discovered through a long weekend of hacking.
  - LED flood lights of various color temperatures and power output were sourced from China.
- Software
  - In order to communicate with the main light over DMX a custom python library was developed that allowed the Beaglebone Black to talk to Enttec's [DMX USB Pro](https://www.enttec.com/products/controls/dmx-usb/2-universe-usb-computer-interface-dmx/) over usb. From there, the DMX channels of the main light were controllable via [OSC](http://opensoundcontrol.org) packets sent from [TouchOSC](https://hexler.net/software/touchosc). This allowed the light to be exercised, run automatically, reset and manipulated from afar.
- Network Architecture
  - [Ubiquiti](https://www.ubnt.com/) equipment was utilized to allow remote control of the main light
- Electrical design
  - Power had to be supplied to the four main and two auxiliary towers. This was accomplished by sourcing 208V 3P from the generator and distributing the power to a sub panel in each of the main towers. From each sub panel, the various circuits for each tower were designed based on the artists needs. In particular, the main light required its own 240v circuit that was accessible from the ground for safety reasons. For the central tower, each floor had its own circuit for ease of wiring.
  - Generators were sized (24KVA) following the preliminary power budget for the revised lighting design.
  - Standard electrical building supplies were utilized to save cost - Romex, D-squared panels, 2-gang wall boxes, etc..

## Links
- [Github](https://github.com/BRLighthouse)

## Special Thanks
- [Samson Yeung](https://github.com/fragmede): For the software help, and on-site aloft linux usb driver debugging


![](images/brls_2.jpg)
![](images/brls_3.jpg)
![](images/brls_4.jpg)
