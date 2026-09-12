package com.globits.richy.service.impl;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.text.Normalizer;
import java.util.Base64;
import java.util.Locale;

public final class StudentMarkShareSupport {
    private StudentMarkShareSupport(){}
    public static String newToken(){byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);}
    public static boolean validToken(String token){return token!=null&&token.matches("[A-Za-z0-9_-]{43}");}
    public static String hashToken(String token){
        try {byte[] digest=MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));StringBuilder out=new StringBuilder();for(byte b:digest)out.append(String.format(Locale.ROOT,"%02x",b&255));return out.toString();}
        catch(java.security.NoSuchAlgorithmException error){throw new IllegalStateException(error);}
    }
    public static String normalizeSearch(String text){
        String normalized=Normalizer.normalize(text==null?"":text,Normalizer.Form.NFC).toLowerCase(Locale.ROOT);
        String[] old={"oà","oá","oả","oã","oạ","oè","oé","oẻ","oẽ","oẹ","uỳ","uý","uỷ","uỹ","uỵ"};
        String[] replacement={"òa","óa","ỏa","õa","ọa","òe","óe","ỏe","õe","ọe","ùy","úy","ủy","ũy","ụy"};
        for(int i=0;i<old.length;i++)normalized=normalized.replace(old[i],replacement[i]);
        return normalized.replaceAll("\\s+"," ").trim();
    }
    public static String nameSortKey(String last,String first){
        String given=Normalizer.normalize(first==null?"":first,Normalizer.Form.NFC).trim().toLowerCase(Locale.ROOT),prior;
        do{prior=given;given=given.replaceAll("\\s*\\([^()]*\\)\\s*$","").replaceAll("\\s*\\[[^\\[\\]]*\\]\\s*$","").trim();}while(!given.equals(prior));
        String full=Normalizer.normalize((last==null?"":last)+" "+given,Normalizer.Form.NFC).toLowerCase(Locale.ROOT).trim().replaceAll("\\s+"," ");
        if(full.isEmpty())return "";
        String[] parts=full.split(" ");StringBuilder key=new StringBuilder();for(int i=parts.length-1;i>=0;i--){if(key.length()>0)key.append('|');key.append(parts[i]);}return key.toString();
    }
}
