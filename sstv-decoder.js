/*
MIT License

Copyright (c) 2024 Christian Kegel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
*/
class SSTVDecoder extends AudioWorkletProcessor {
  leaderToneDetected = false;
  sstvFormat;

  constructor(){
    super();
  }

  process(inputs, outputs, parameters){
    //Apply the Goertzel algorithm (more performant/save battery) to idenify the VIS Header, but use FFT (for now)

    //Detect a mode and load appropriate parameters

    //Apply Goertzel algorithm to recognize sync pulses, and call `onLineRecieved` Callback with freq data
    //Note: We don't have to live decode the freq data, just collect it between sync pulses and measure the time to see if we missed a sync
    return true;
  }

}
registerProcessor('sstv-decoder', SSTVDecoder);