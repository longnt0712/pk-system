package com.globits.richy;

import java.io.IOException;
import java.io.*;
import java.nio.file.*;
import java.text.Normalizer;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Date;
import java.util.regex.Pattern;

import org.joda.time.LocalDateTime;
import org.springframework.web.multipart.MultipartFile;

//import com.globits.taskman.domain.TaskFlow;
//import com.globits.taskman.domain.TaskFlowStep;

public class test {
	public static void main(String args[]) {
//		String text = "Phẩm giá,  bắt nguồn. [] 1. 2. 3. 4. 5. 6. 7. 8. 9. 10. \\  'abc' Lc 1,4-2 ; (xyz) {sdf} từ việc \n \" : . ? ";
//		text = text.replaceAll("[\\[\\].\n\",:?'(){};-=/]", "");
//		text = text.replaceAll("\\s{2,}", " ").trim();
//		String[] list = text.split(" ");
//		System.out.println(text);
//		System.out.println(list);
		
		LocalDateTime currentDate = LocalDateTime.now();
		
//		try {
//			Date date = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss").parse(currentDate.toString());
//		} catch (ParseException e1) {
//			// TODO Auto-generated catch block
//			e1.printStackTrace();
//		}
		String day = String.valueOf(currentDate.getDayOfMonth());
		String month = String.valueOf(currentDate.getMonthOfYear());
		if(Integer.parseInt(month) < 10) {
			month = "0"+ month;
		}
		String year = String.valueOf(currentDate.getYear());
		String code = day+month+year;
		System.out.println(code);
		
		String text = "Bùi Hiếu\r\n" + 
				"0389366351\r\n" + 
				"55.hoang hoa tham.khu phố 6.thị trân ba tri.tỉnh bên tre ạ\r\n" + 
				"1 duet hồng size 38\r\n" + 
//				"6 - random -jb nữ tính\r\n" +   
				"10jb - (73, 52, 14,56,57,60 + 4 jb random marvel)\r\n" + 
				"tổng bill: 280k + 30k ship + 14k jb = 324k\r\n" + 
				"Hẹn Giao Hàng 30/4";
		String[] list = text.split("\n");
		
		String customerName = list[0];
		String phoneNumber = list[1];
		String address = list[2];
		String itemName = list[3];
		String jb = list[4];
		String note = list[6];
		
		/*process jb : principle: quantity - random - note bất kỳ. example: 10 random
        quantity - số - note bất kỳ.
		*/
		String[] textJb = jb.split("-");
		String quantityJb = textJb[0];
		String subTextJb = textJb[1];
//		String noteJb = textJb[2];
		
		quantityJb = quantityJb.replaceAll("\\D+","");
		
		//process numberJb
//		numberJb = numberJb.replaceAll("[\\\\.\n\",:_?'(){}!;=\\[\\]/-]", " ");
		subTextJb = subTextJb.replaceAll("[()]", " ");
		subTextJb = subTextJb.replaceAll("\\s{2,}", " ").trim();
		
		String[] listNumberJb = subTextJb.split("\\+");
		
		if(listNumberJb.length == 1) {
			String testNumber = listNumberJb[0].replaceAll("[\\\\.\n\",:_?'(){}!;=\\[\\]/-]", "");
			testNumber = testNumber.replaceAll("\\s{2,}", " ").trim();
			testNumber = testNumber.replaceAll(" ","");
			
	        boolean numeric = true;

	        try {
	            Double num = Double.parseDouble(testNumber);
	        } catch (NumberFormatException e) {
	            numeric = false;
	        }

	        if(numeric) {
	        	String text1 = listNumberJb[0];
	        	text1 = text1.replaceAll("[\\\\.\n\",:_?'(){}!;=\\[\\]/-]", " ");
	        	text1 = text1.replaceAll("\\s{2,}", " ").trim();
	        	
	        	String[] listNumber = text1.split(" ");
	        	
	        	
	        	String temp = listNumber[0];

	    		for (int i = 0 ; i < listNumber.length - 1; i++) {
	                for (int j = i + 1; j < listNumber.length; j++) {
	                    if (Integer.parseInt(listNumber[i]) > Integer.parseInt(listNumber[j])) {
	                    	temp = listNumber[j];
	                    	listNumber[j] = listNumber[i];
	                    	listNumber[i] = temp;
	                    }
	                }
	            }
	    		
	    		for (int i = 0 ; i < listNumber.length; i++) {
	    			System.out.print(listNumber[i] + " ");
	    		}
	        }
	        else {
	        	System.out.println(testNumber + " is not a number");
	        }
		}
		
		if(listNumberJb.length == 2) {
			String text1 = listNumberJb[0];
			String text2 = listNumberJb[1];
        	text1 = text1.replaceAll("[\\\\.\n\",:_?'(){}!;=\\[\\]/-]", " ");
        	text1 = text1.replaceAll("\\s{2,}", " ").trim();
        	
        	text2 = text2.replaceAll("\\s{2,}", " ").trim();
        	
        	String[] listNumber = text1.split(" ");
        	String temp = listNumber[0];

    		for (int i = 0 ; i < listNumber.length - 1; i++) {
                for (int j = i + 1; j < listNumber.length; j++) {
                    if (Integer.parseInt(listNumber[i]) > Integer.parseInt(listNumber[j])) {
                    	temp = listNumber[j];
                    	listNumber[j] = listNumber[i];
                    	listNumber[i] = temp;
                    }
                }
            }
    		
    		for (int i = 0 ; i < listNumber.length; i++) {
    			System.out.print(listNumber[i] + " ");
    		}
		}
		
//		String temp = listNumberJb[0];
//
//		for (int i = 0 ; i < listNumberJb.length - 1; i++) {
//            for (int j = i + 1; j < listNumberJb.length; j++) {
//                if (Integer.parseInt(listNumberJb[i]) > Integer.parseInt(listNumberJb[j])) {
//                	temp = listNumberJb[j];
//                	listNumberJb[j] = listNumberJb[i];
//                	listNumberJb[i] = temp;
//                }
//            }
//        }
//		System.out.println(quantityJb);
////		System.out.println(numberJb);
//		
//		for (int i = 0 ; i < listNumberJb.length; i++) {
//			System.out.print(listNumberJb[i] + " ");
//		}
		
//		for(int i = 0 ; i < textJb.length; i++) {
//			System.out.println(textJb[i].trim());
//		}
		
//		for(int i = 0 ; i < list.length; i++) {
//			System.out.println(list[i]);
//		}
		

		
//		String test = " 1 , 2 ; 3 4 5 - _ \\  ! { 6 [ 7]   8";
//		test = test.replaceAll("[\\\\.\n\",:_?'(){}!;=\\[\\]/-]", "");
//		test = test.replaceAll("\\s{2,}", " ").trim();
//		System.out.println(test);
//		
//		ItemDto searchDto = new ItemDto();
//		searchDto.setTextSearch("1, 30, 20, 10, 20, 42, 50 , 31");
//		String text = searchDto.getTextSearch();
//		text = text.replaceAll("[\\\\.\n\",:_?'(){}!;=\\[\\]/-]", "");
//		text = text.replaceAll("\\s{2,}", " ").trim();
//		String[] list = text.split(" ");
//		
//		String temp = list[0];
//
//		for (int i = 0 ; i < list.length - 1; i++) {
//            for (int j = i + 1; j < list.length; j++) {
//                if (Integer.parseInt(list[i]) > Integer.parseInt(list[j])) {
//                	temp = list[j];
//                	list[j] = list[i];
//                	list[i] = temp;
//
//                }
//            }
//        }
//		
//		for (int i = 0 ; i < list.length; i++) {
//			System.out.print(list[i] + " ");
//		}
		
//		String text1 = "cac moi phuc";
//		String text2 = "cac moi phuc";
//		System.out.println(text1 == text2);
//		System.out.println(deAccent("Xin chào Việt Nam"));
//		String text3 = "Xin chao Viet Nam";
//		System.out.println(text3.equals(deAccent("Xin chào Việt Nam")));
	}
	
	public static String deAccent(String str) {
        String nfdNormalizedString = Normalizer.normalize(str, Normalizer.Form.NFD); 
        Pattern pattern = Pattern.compile("\\p{InCombiningDiacriticalMarks}+");
        return pattern.matcher(nfdNormalizedString).replaceAll("");
    }
	
	public static void saveFile(String uploadDir, String fileName,
            MultipartFile multipartFile) throws IOException {
        Path uploadPath = Paths.get(uploadDir);
//        String s = uploadDir + "/" + fileName;
//        Path f = Paths.get(s);
//        System.out.println(f);
         
        if (!Files.exists(uploadPath)) {
            Files.createDirectories(uploadPath);
        }
        
//        if (Files.exists(f)) {
//            Files.delete(f);
//        	System.out.println("có");
//        }
         
        try (InputStream inputStream = multipartFile.getInputStream()) {
            Path filePath = uploadPath.resolve(fileName);
            Files.copy(inputStream, filePath, StandardCopyOption.REPLACE_EXISTING);
            
        } catch (IOException ioe) {        
            throw new IOException("Could not save image file: " + fileName, ioe);
        }      
    }
	
	public static void deleteFileOad(String uploadDir, String fileName) throws IOException {
      String s = uploadDir + fileName;
      Path f = Paths.get(s);
        
      if (Files.exists(f)) {
        Files.delete(f);
      }
        
    }
	
	
	public static boolean isShortEnoughString(String str) {
        if(str == null) {
        	return true;
        }else if(str != null && str.length() < 30000) {
        	return true;
        }
        return false;    
    }
	
	public static boolean isLongEnoughString(String str) {
        if(str == null) {
        	return true;
        }else if(str != null && str.length() < 300000) {
        	return true;
        }
        return false;    
    }
}
