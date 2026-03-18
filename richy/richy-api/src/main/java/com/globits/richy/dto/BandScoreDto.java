package com.globits.richy.dto;

import java.io.Serializable;
import java.util.HashMap;



public class BandScoreDto implements Serializable{
	
	public Double bandScoreReading;

	public Double getBandScoreReading() {
		return bandScoreReading;
	}

	public void setBandScoreReading(Double bandScoreReading) {
		this.bandScoreReading = bandScoreReading;
	}



	public BandScoreDto(Integer correctAnswers, Integer type) {
		if(correctAnswers == null || type == null) {
			return;
		}
		if(type == 1) {
			if(correctAnswers >= 4 && correctAnswers <= 5) {
				this.bandScoreReading = 2.5;
			}
			
			if(correctAnswers >= 6 && correctAnswers <= 7) {
				this.bandScoreReading = 3.0;
			}
			
			if(correctAnswers >= 8 && correctAnswers <= 9) {
				this.bandScoreReading = 3.5;
			}
			
			if(correctAnswers >= 10 && correctAnswers <= 12) {
				this.bandScoreReading = 4.0;
			}
			
			if(correctAnswers >= 13 && correctAnswers <= 14) {
				this.bandScoreReading = 4.5;
			}
			
			if(correctAnswers >= 15 && correctAnswers <= 18) {
				this.bandScoreReading = 5.0;
			}
			
			if(correctAnswers >= 19 && correctAnswers <= 22) {
				this.bandScoreReading = 5.5;
			}
			
			if(correctAnswers >= 23 && correctAnswers <= 26) {
				this.bandScoreReading = 6.0;
			}
			
			if(correctAnswers >= 27 && correctAnswers <= 29) {
				this.bandScoreReading = 6.5;
			}
			
			if(correctAnswers >= 30 && correctAnswers <= 32) {
				this.bandScoreReading = 7.0;
			}
			
			if(correctAnswers >= 33 && correctAnswers <= 34) {
				this.bandScoreReading = 7.5;
			}
			
			if(correctAnswers >= 35 && correctAnswers <= 36) {
				this.bandScoreReading = 8.0;
			}
			
			if(correctAnswers >= 37 && correctAnswers <= 38) {
				this.bandScoreReading = 8.5;
			}
			
			if(correctAnswers >= 39 && correctAnswers <= 40) {
				this.bandScoreReading = 9.0;
			}
		} else if(type == 2) {
			if(correctAnswers >= 4 && correctAnswers <= 5) {
				this.bandScoreReading = 2.5;
			}
			
			if(correctAnswers >= 6 && correctAnswers <= 7) {
				this.bandScoreReading = 3.0;
			}
			
			if(correctAnswers >= 8 && correctAnswers <= 10) {
				this.bandScoreReading = 3.5;
			}
			
			if(correctAnswers >= 11 && correctAnswers <= 12) {
				this.bandScoreReading = 4.0;
			}
			
			if(correctAnswers >= 13 && correctAnswers <= 15) {
				this.bandScoreReading = 4.5;
			}
			
			if(correctAnswers >= 16 && correctAnswers <= 17) {
				this.bandScoreReading = 5.0;
			}
			
			if(correctAnswers >= 18 && correctAnswers <= 22) {
				this.bandScoreReading = 5.5;
			}
			
			if(correctAnswers >= 23 && correctAnswers <= 25) {
				this.bandScoreReading = 6.0;
			}
			
			if(correctAnswers >= 26 && correctAnswers <= 29) {
				this.bandScoreReading = 6.5;
			}
			
			if(correctAnswers >= 30 && correctAnswers <= 31) {
				this.bandScoreReading = 7.0;
			}
			
			if(correctAnswers >= 32 && correctAnswers <= 34) {
				this.bandScoreReading = 7.5;
			}
			
			if(correctAnswers >= 35 && correctAnswers <= 36) {
				this.bandScoreReading = 8.0;
			}
			
			if(correctAnswers >= 37 && correctAnswers <= 38) {
				this.bandScoreReading = 8.5;
			}
			
			if(correctAnswers >= 39 && correctAnswers <= 40) {
				this.bandScoreReading = 9.0;
			}
		}
	}

	
}
