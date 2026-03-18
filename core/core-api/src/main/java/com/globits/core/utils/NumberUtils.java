package com.globits.core.utils;

import java.math.BigDecimal;
import java.math.RoundingMode;

public class NumberUtils {
	public static Double round(Double val, int newScale) {
		if(val!=null && val>0) {
			 return new BigDecimal(val.toString()).setScale(newScale,RoundingMode.HALF_UP).doubleValue();
		}else {
			return 0D;
		}
	   
	}
}
