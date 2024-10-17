# Web SSTV
## Summary
Web SSTV aims to both encode and decode SSTV using plain JavaScript and Web Audio API. Web SSTV can be run entirely offline (without styling), and on any platform from Chromebooks to phones, so long as they support JavaScript and Web Audio. By making SSTV readily available on many platforms, we aim to create educational opportunities and introduce more people to STEM and amateur radio. Web SSTV is currently hosted at https://ckegel.github.io/Web-SSTV/.
## Current State
Currently Web SSTV supports encoding images using the Martin, Scottie, PD, and WRASSE SC2-180 formats. Support for transmitting in the Robot format and in black and white underway. Decoding has proven to be a greater challenge. I am currently in the process of writing a custom Web Audio Worklet that leverages the Goertzel Algorithm to detect VIS headers and sync pulses. Pull requests are welcome.
## Sources
Both the [SSTV Handbook](https://www.sstv-handbook.com/) and [JL Barber's (N7CXI) Proposal for SSTV Mode Specifications ](http://www.barberdsp.com/downloads/Dayton%20Paper.pdf) were heavily referenced when implementing support for the Martin and Scottie formats.
## License
Web-SSTV is available freely under the MIT license. Should you decide to host your own instance of WebSSTV without substantial modification, please provide a link to this repository and a copy of the MIT license, including the original copyright statement.